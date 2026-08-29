import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Config } from "./config.js";
import { SessionStore } from "./session-store.js";
import type { Answer, QueryInput, VisionService } from "./types.js";

const followUpSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  locale: z.string().trim().min(2).max(20).default("de-DE"),
});

const questionSchema = followUpSchema.extend({
  sessionId: z.string().trim().min(1).max(200).optional(),
});

function authorized(header: string | undefined, expected?: string): boolean {
  if (!expected) return true;
  if (!header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function sniffImageMime(data: Buffer, declared: string): string | undefined {
  if (declared.startsWith("image/")) return declared;
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return undefined;
}

function answerContext(answer: Answer): string {
  const structured = answer.blocks.map((block) => {
    if (block.type === "code") return `Code (${block.language}):\n${block.code}`;
    if (block.type === "math") return `Formula (LaTeX): ${block.latex}`;
    return block.markdown;
  }).join("\n\n");
  return `${answer.spokenAnswer}\n\n${structured}`.slice(0, 12_000);
}

export async function buildApp(config: Config, vision: VisionService): Promise<FastifyInstance> {
  const app = Fastify({ logger: { redact: ["req.headers.authorization"] }, bodyLimit: Math.max(config.MAX_IMAGE_BYTES, config.MAX_AUDIO_BYTES) + 1024 * 1024 });
  const sessions = new SessionStore(config.SESSION_TTL_SECONDS * 1000);
  let dailyUsage = 0;
  let usageDay = new Date().toISOString().slice(0, 10);

  await app.register(cors, { origin: false });
  await app.register(rateLimit, { max: 30, timeWindow: "1 minute" });
  await app.register(multipart, {
    limits: { files: 2, fileSize: Math.max(config.MAX_IMAGE_BYTES, config.MAX_AUDIO_BYTES), fields: 6 },
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    if (!authorized(request.headers.authorization, config.CLIENT_TOKEN)) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (request.method === "POST" && (request.url.startsWith("/v1/queries") || request.url === "/v1/questions")) {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== usageDay) {
        usageDay = today;
        dailyUsage = 0;
      }
      if (dailyUsage >= config.DAILY_QUERY_LIMIT) {
        return reply.code(429).send({ error: "daily_limit_reached" });
      }
      dailyUsage += 1;
    }
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/v1/transcriptions", async (request, reply) => {
    let audio: { data: Buffer; mime: string; filename: string } | undefined;
    for await (const part of request.parts()) {
      if (part.type === "file" && part.fieldname === "audio") {
        audio = { data: await part.toBuffer(), mime: part.mimetype, filename: part.filename || "question.m4a" };
      }
    }
    if (!audio) return reply.code(400).send({ error: "audio_required" });
    if (audio.data.length > config.MAX_AUDIO_BYTES) return reply.code(413).send({ error: "audio_too_large" });
    const transcript = (await vision.transcribe(audio.data, audio.filename, audio.mime)).trim();
    if (!transcript) return reply.code(422).send({ error: "speech_not_recognized" });
    return { transcript };
  });

  app.post("/v1/questions", async (request, reply) => {
    const parsed = questionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_question" });
    const sessionId = parsed.data.sessionId || randomUUID();
    const input: QueryInput = {
      question: parsed.data.question,
      locale: parsed.data.locale,
    };
    const answer = await vision.answer(input);
    sessions.set(sessionId, { ...input, previousQuestion: input.question, previousAnswer: answerContext(answer) });
    return reply.code(201).send({ queryId: randomUUID(), sessionId, question: input.question, ...answer });
  });

  app.post("/v1/queries", async (request, reply) => {
    const fields: Record<string, string> = {};
    let image: { data: Buffer; mime: string } | undefined;
    let audio: { data: Buffer; mime: string; filename: string } | undefined;

    for await (const part of request.parts()) {
      if (part.type === "field") {
        fields[part.fieldname] = String(part.value);
      } else {
        const data = await part.toBuffer();
        if (part.fieldname === "image") image = { data, mime: part.mimetype };
        if (part.fieldname === "audio") audio = { data, mime: part.mimetype, filename: part.filename || "question.m4a" };
      }
    }

    if (!image) return reply.code(400).send({ error: "valid_image_required" });
    const verifiedImageMime = sniffImageMime(image.data, image.mime);
    if (!verifiedImageMime) return reply.code(400).send({ error: "valid_image_required" });
    if (image.data.length > config.MAX_IMAGE_BYTES) return reply.code(413).send({ error: "image_too_large" });
    if (audio && audio.data.length > config.MAX_AUDIO_BYTES) return reply.code(413).send({ error: "audio_too_large" });

    let question = (fields.question || "").trim();
    if (!question && audio) question = await vision.transcribe(audio.data, audio.filename, audio.mime);
    if (!question) return reply.code(400).send({ error: "question_or_audio_required" });

    const sessionId = fields.sessionId?.trim() || randomUUID();
    const input: QueryInput = {
      image: image.data,
      imageMimeType: verifiedImageMime,
      question,
      ocrText: (fields.ocrText || "").slice(0, 30_000),
      locale: (fields.locale || "de-DE").slice(0, 20),
    };
    const answer = await vision.answer(input);
    sessions.set(sessionId, { ...input, previousQuestion: input.question, previousAnswer: answerContext(answer) });
    return reply.code(201).send({ queryId: randomUUID(), sessionId, question, ...answer });
  });

  app.post("/v1/queries/:id/follow-ups", async (request, reply) => {
    const { id } = request.params as { id: string };
    let followUpInput: unknown = request.body;
    if (request.isMultipart()) {
      const fields: Record<string, string> = {};
      let audio: { data: Buffer; mime: string; filename: string } | undefined;
      for await (const part of request.parts()) {
        if (part.type === "field") fields[part.fieldname] = String(part.value);
        if (part.type === "file" && part.fieldname === "audio") {
          audio = { data: await part.toBuffer(), mime: part.mimetype, filename: part.filename || "follow-up.m4a" };
        }
      }
      if (audio && audio.data.length > config.MAX_AUDIO_BYTES) return reply.code(413).send({ error: "audio_too_large" });
      let question = (fields.question || "").trim();
      if (!question && audio) question = await vision.transcribe(audio.data, audio.filename, audio.mime);
      followUpInput = { question, locale: fields.locale || "de-DE" };
    }
    const parsed = followUpSchema.safeParse(followUpInput);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_follow_up" });
    const previous = sessions.get(id);
    if (!previous) return reply.code(404).send({ error: "session_expired" });
    const input = { ...previous, question: parsed.data.question, locale: parsed.data.locale };
    const answer = await vision.answer(input);
    sessions.set(id, { ...input, previousQuestion: input.question, previousAnswer: answerContext(answer) });
    return { queryId: randomUUID(), sessionId: id, question: input.question, ...answer };
  });

  app.delete("/v1/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    sessions.delete(id);
    return reply.code(204).send();
  });

  app.addHook("onClose", async () => sessions.close());
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    app.log.error({ err: error }, "request failed");
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 502;
    reply.code(status).send({
      error: status === 502 ? "ai_service_unavailable" : error.message,
      requestStage: status >= 500 ? "ai" : "request",
    });
  });
  return app;
}
