import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import type { Config } from "./config.js";
import type { VisionService } from "./types.js";

const config: Config = {
  OPENAI_API_KEY: "test",
  OPENAI_VISION_MODEL: "test-vision",
  OPENAI_TRANSCRIBE_MODEL: "test-transcribe",
  CLIENT_TOKEN: "1234567890123456",
  PORT: 3000,
  SESSION_TTL_SECONDS: 60,
  MAX_IMAGE_BYTES: 1024,
  MAX_AUDIO_BYTES: 1024,
  DAILY_QUERY_LIMIT: 100,
};

const answer = {
  shortAnswer: "42",
  spokenAnswer: "Die Antwort ist 42.",
  evidence: ["Auf der Folie steht 42."],
  confidence: 0.95,
  needsRetake: false,
  retakeHint: null,
};

function multipart(boundary: string, fields: Record<string, string>, image = Buffer.from([0xff, 0xd8, 0xff, 0xdb])): Buffer {
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="page.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`));
  chunks.push(image, Buffer.from(`\r\n--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

describe("query API", () => {
  it("requires authentication", async () => {
    const vision = { answer: vi.fn(), transcribe: vi.fn() } as unknown as VisionService;
    const app = await buildApp(config, vision);
    const response = await app.inject({ method: "POST", url: "/v1/queries" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("answers and supports an in-memory follow-up", async () => {
    const vision: VisionService = { answer: vi.fn().mockResolvedValue(answer), transcribe: vi.fn() };
    const app = await buildApp(config, vision);
    const boundary = "test-boundary";
    const first = await app.inject({
      method: "POST",
      url: "/v1/queries",
      headers: { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(boundary, { question: "Was ist die Antwort?", sessionId: "session-1", ocrText: "42" }),
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().shortAnswer).toBe("42");

    const followUp = await app.inject({
      method: "POST",
      url: "/v1/queries/session-1/follow-ups",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "Warum?" },
    });
    expect(followUp.statusCode).toBe(200);
    expect(vision.answer).toHaveBeenCalledTimes(2);

    const removed = await app.inject({ method: "DELETE", url: "/v1/sessions/session-1", headers: { authorization: "Bearer 1234567890123456" } });
    expect(removed.statusCode).toBe(204);
    await app.close();
  });

  it("enforces the configured daily AI request limit", async () => {
    const vision: VisionService = { answer: vi.fn().mockResolvedValue(answer), transcribe: vi.fn() };
    const app = await buildApp({ ...config, DAILY_QUERY_LIMIT: 1 }, vision);
    const boundary = "limit-boundary";
    const payload = multipart(boundary, { question: "Test" });
    const headers = { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${boundary}` };
    expect((await app.inject({ method: "POST", url: "/v1/queries", headers, payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/v1/queries", headers, payload })).statusCode).toBe(429);
    await app.close();
  });
});
