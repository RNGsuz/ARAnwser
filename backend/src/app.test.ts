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
  answerKind: "solution" as const,
  shortAnswer: "42",
  glassesSummary: { format: "output" as const, lines: ["a) 42"] },
  glassesExercises: [],
  recognizedItems: [],
  glassesCodeUnits: [],
  discoveryInfo: null,
  readingInfo: null,
  solution: {
    kind: "math" as const,
    title: "Lösungsweg",
    steps: [{ title: "Addieren", explanation: "Die beiden Werte werden addiert.", contentType: "math" as const, content: "40 + 2 = 42", language: null }],
  },
  spokenAnswer: "Die Antwort ist 42.",
  evidence: ["Auf der Folie steht 42."],
  confidence: 0.95,
  needsRetake: false,
  retakeHint: null,
  blocks: [{ type: "text" as const, markdown: "Die Antwort ist **42**." }],
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

function audioMultipart(boundary: string): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="locale"\r\n\r\nde-DE\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="follow-up.m4a"\r\nContent-Type: audio/mp4\r\n\r\n`),
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe("query API", () => {
  it("requires authentication", async () => {
    const vision = { answer: vi.fn(), transcribe: vi.fn() } as unknown as VisionService;
    const app = await buildApp(config, vision);
    const response = await app.inject({ method: "POST", url: "/v1/queries" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("reports an incomplete AI response distinctly", async () => {
    const vision: VisionService = { answer: vi.fn().mockRejectedValue(new Error("ai_response_incomplete")), classify: vi.fn(), transcribe: vi.fn() };
    const app = await buildApp(config, vision);
    const response = await app.inject({
      method: "POST",
      url: "/v1/questions",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "Erkläre diesen Code.", locale: "de-DE" },
    });
    expect(response.statusCode).toBe(502);
    expect(response.json().error).toBe("ai_response_incomplete");
    await app.close();
  });

  it("returns a transcript before a query is submitted", async () => {
    const vision: VisionService = {
      answer: vi.fn(),
      classify: vi.fn(),
      transcribe: vi.fn().mockResolvedValue("  Was ist der Median?  "),
    };
    const app = await buildApp(config, vision);
    const boundary = "transcription-boundary";
    const response = await app.inject({
      method: "POST",
      url: "/v1/transcriptions",
      headers: { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: audioMultipart(boundary),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ transcript: "Was ist der Median?" });
    expect(vision.answer).not.toHaveBeenCalled();
    await app.close();
  });

  it("answers a general question without requiring an image", async () => {
    const codeAnswer = { ...answer, blocks: [{ type: "code" as const, language: "java", code: "int value = 42;" }] };
    const vision: VisionService = { answer: vi.fn().mockResolvedValueOnce(codeAnswer).mockResolvedValue(answer), classify: vi.fn(), transcribe: vi.fn() };
    const app = await buildApp(config, vision);
    const response = await app.inject({
      method: "POST",
      url: "/v1/questions",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "Warum ist der Himmel blau?", locale: "de-DE", sessionId: "general-session" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().sessionId).toBe("general-session");
    expect(vision.answer).toHaveBeenCalledWith({ question: "Warum ist der Himmel blau?", locale: "de-DE", includeSteps: true, intent: "question" });

    const followUp = await app.inject({
      method: "POST",
      url: "/v1/queries/general-session/follow-ups",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "Kannst du es einfacher erklären?" },
    });
    expect(followUp.statusCode).toBe(200);
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({
      question: "Kannst du es einfacher erklären?",
      locale: "de-DE",
      previousQuestion: "Warum ist der Himmel blau?",
      previousAnswer: expect.stringContaining(answer.spokenAnswer),
    }));
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({
      previousAnswer: expect.stringContaining("int value = 42;"),
    }));
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({
      previousAnswer: expect.stringContaining("Step 1 – Addieren"),
    }));
    await app.close();
  });

  it("answers and supports an in-memory follow-up", async () => {
    const vision: VisionService = { answer: vi.fn().mockResolvedValue(answer), classify: vi.fn(), transcribe: vi.fn() };
    const app = await buildApp(config, vision);
    const boundary = "test-boundary";
    const first = await app.inject({
      method: "POST",
      url: "/v1/queries",
      headers: { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(boundary, { question: "Was ist die Antwort?", sessionId: "session-1", ocrText: "42", includeSteps: "false", intent: "discover" }),
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().shortAnswer).toBe("42");
    expect(vision.answer).toHaveBeenNthCalledWith(1, expect.objectContaining({ includeSteps: false, intent: "discover" }));

    const followUp = await app.inject({
      method: "POST",
      url: "/v1/queries/session-1/follow-ups",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "Warum?" },
    });
    expect(followUp.statusCode).toBe(200);
    expect(vision.answer).toHaveBeenCalledTimes(2);
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({ intent: "discover" }));
    expect(vision.answer).toHaveBeenLastCalledWith(expect.not.objectContaining({ image: expect.any(Buffer) }));

    const visualFollowUp = await app.inject({
      method: "POST",
      url: "/v1/queries/session-1/follow-ups",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "Was steht in der dritten Tabellenzeile?" },
    });
    expect(visualFollowUp.statusCode).toBe(200);
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({ image: expect.any(Buffer), imageMimeType: "image/jpeg" }));

    const removed = await app.inject({ method: "DELETE", url: "/v1/sessions/session-1", headers: { authorization: "Bearer 1234567890123456" } });
    expect(removed.statusCode).toBe(204);
    await app.close();
  });

  it("keeps the image for a short answer that selects one of several tasks", async () => {
    const selectionAnswer = { ...answer, solution: { kind: "selection" as const, title: "Aufgabe auswählen", steps: [] } };
    const vision: VisionService = {
      answer: vi.fn().mockResolvedValueOnce(selectionAnswer).mockResolvedValueOnce(answer).mockResolvedValueOnce(answer),
      classify: vi.fn(), transcribe: vi.fn(),
    };
    const app = await buildApp(config, vision);
    const boundary = "task-selection-boundary";
    const first = await app.inject({
      method: "POST", url: "/v1/queries",
      headers: { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(boundary, { question: "Welche Aufgaben sind sichtbar?", sessionId: "selection-session", intent: "solve" }),
    });
    expect(first.statusCode).toBe(201);

    const selected = await app.inject({
      method: "POST", url: "/v1/queries/selection-session/follow-ups",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "1!", locale: "de-DE", includeSteps: true },
    });
    expect(selected.statusCode).toBe(200);
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({
      question: "1!", image: expect.any(Buffer), imageMimeType: "image/jpeg", imageResent: true,
    }));

    const nextSelected = await app.inject({
      method: "POST", url: "/v1/queries/selection-session/follow-ups",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { question: "2!", locale: "de-DE", includeSteps: true },
    });
    expect(nextSelected.statusCode).toBe(200);
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({
      question: "2!", image: expect.any(Buffer), imageMimeType: "image/jpeg", imageResent: true,
    }));
    await app.close();
  });

  it("transcribes a spoken follow-up and reuses the existing image", async () => {
    const vision: VisionService = {
      answer: vi.fn().mockResolvedValue(answer),
      classify: vi.fn(),
      transcribe: vi.fn().mockResolvedValue("Löse Aufgabe zwei."),
    };
    const app = await buildApp(config, vision);
    const firstBoundary = "initial-boundary";
    await app.inject({
      method: "POST",
      url: "/v1/queries",
      headers: { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${firstBoundary}` },
      payload: multipart(firstBoundary, { question: "Welche Aufgaben sind sichtbar?", sessionId: "spoken-session" }),
    });

    const followUpBoundary = "audio-boundary";
    const followUp = await app.inject({
      method: "POST",
      url: "/v1/queries/spoken-session/follow-ups",
      headers: { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${followUpBoundary}` },
      payload: audioMultipart(followUpBoundary),
    });

    expect(followUp.statusCode).toBe(200);
    expect(followUp.json().question).toBe("Löse Aufgabe zwei.");
    expect(vision.transcribe).toHaveBeenCalledOnce();
    expect(vision.answer).toHaveBeenLastCalledWith(expect.objectContaining({ question: "Löse Aufgabe zwei." }));
    await app.close();
  });

  it("classifies an uploaded image and reuses it for the selected pipeline", async () => {
    const vision: VisionService = {
      answer: vi.fn().mockResolvedValue(answer),
      classify: vi.fn().mockResolvedValue({ suggestedMode: "read", reason: "Eine Informationsfolie ist sichtbar.", confidence: 0.96 }),
      transcribe: vi.fn(),
    };
    const app = await buildApp(config, vision);
    const boundary = "classification-boundary";
    const classified = await app.inject({
      method: "POST",
      url: "/v1/classifications",
      headers: { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(boundary, { sessionId: "auto-session", locale: "de-DE" }),
    });
    expect(classified.statusCode).toBe(201);
    expect(classified.json()).toEqual({ sessionId: "auto-session", suggestedMode: "read", reason: "Eine Informationsfolie ist sichtbar.", confidence: 0.96 });
    expect(vision.classify).toHaveBeenCalledWith(expect.any(Buffer), "image/jpeg", "de-DE");

    const response = await app.inject({
      method: "POST",
      url: "/v1/classifications/auto-session/answer",
      headers: { authorization: "Bearer 1234567890123456", "content-type": "application/json" },
      payload: { intent: "read", question: "Fasse den sichtbaren Inhalt zusammen.", includeSteps: false, locale: "de-DE" },
    });
    expect(response.statusCode).toBe(201);
    expect(vision.answer).toHaveBeenCalledWith(expect.objectContaining({
      image: expect.any(Buffer), imageMimeType: "image/jpeg", intent: "read", includeSteps: false,
    }));
    await app.close();
  });

  it("enforces the configured daily AI request limit", async () => {
    const vision: VisionService = { answer: vi.fn().mockResolvedValue(answer), classify: vi.fn(), transcribe: vi.fn() };
    const app = await buildApp({ ...config, DAILY_QUERY_LIMIT: 1 }, vision);
    const boundary = "limit-boundary";
    const payload = multipart(boundary, { question: "Test" });
    const headers = { authorization: "Bearer 1234567890123456", "content-type": `multipart/form-data; boundary=${boundary}` };
    expect((await app.inject({ method: "POST", url: "/v1/queries", headers, payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/v1/queries", headers, payload })).statusCode).toBe(429);
    await app.close();
  });
});
