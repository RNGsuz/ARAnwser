import { describe, expect, it } from "vitest";
import { selectPipelinePolicy } from "./pipeline-policy.js";

const models = { defaultModel: "default", fastModel: "fast", reasoningModel: "reasoning" };

describe("pipeline policy", () => {
  it("keeps discovery lightweight and free of document tools", () => {
    const policy = selectPipelinePolicy({ intent: "discover", question: "Was ist das?", locale: "de-DE" }, models);
    expect(policy).toMatchObject({ taskKind: "direct", model: "fast", maxOutputTokens: 900, imageDetail: "auto", allowedTools: [] });
  });

  it("allows OCR for reading without exposing solve tools", () => {
    const policy = selectPipelinePolicy({ intent: "read", question: "Fasse die Slide zusammen", locale: "de-DE" }, models);
    expect(policy.allowedTools).toEqual(["ocr"]);
    expect(policy.maxOutputTokens).toBe(1600);
  });

  it("reserves larger reasoning responses for code", () => {
    const policy = selectPipelinePolicy({ intent: "solve", question: "Implementiere drei Methoden in Java", locale: "de-DE" }, models);
    expect(policy).toMatchObject({ model: "reasoning", reasoningEffort: "medium", maxOutputTokens: 5000 });
    expect(policy.allowedTools).toEqual(["ocr", "code_verifier"]);
  });

  it("marks calculator as eligible only for mathematical solve requests", () => {
    const math = selectPipelinePolicy({ intent: "solve", question: "Berechne den Median", locale: "de-DE" }, models);
    const general = selectPipelinePolicy({ intent: "question", question: "Erkläre die Renaissance", locale: "de-DE" }, models);
    expect(math.allowedTools).toContain("calculator");
    expect(general.allowedTools).toEqual([]);
  });

  it("routes general code questions without changing the user-facing intent", () => {
    const policy = selectPipelinePolicy({ intent: "question", question: "Implementiere Bubble Sort in Java", locale: "de-DE" }, models);
    expect(policy).toMatchObject({ intent: "question", taskKind: "code", model: "reasoning", maxOutputTokens: 5000 });
    expect(policy.allowedTools).toEqual(["code_verifier"]);
  });
});
