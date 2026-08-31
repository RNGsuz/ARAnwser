import { describe, expect, it } from "vitest";
import { calculateArithmetic } from "./calculator.js";
import { validateAnswerWithTools } from "./answer-validation.js";
import type { Answer } from "./types.js";

function answer(overrides: Partial<Answer> = {}): Answer {
  return {
    answerKind: "solution", shortAnswer: "ok", glassesSummary: { format: "text", lines: ["ok"] }, glassesExercises: [], recognizedItems: [], glassesCodeUnits: [], discoveryInfo: null, readingInfo: null,
    solution: { kind: "direct", title: "Antwort", steps: [] }, spokenAnswer: "ok", evidence: [], confidence: 1, needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "ok" }], ...overrides,
  };
}

describe("deterministic answer tools", () => {
  it("calculates bounded arithmetic without eval", () => {
    expect(calculateArithmetic("(2 + 3) * 4 - 6 / 2")).toBe(17);
    expect(calculateArithmetic("process.exit()" )).toBeNull();
  });

  it("accepts one complete requested method", () => {
    const value = answer({ glassesCodeUnits: [{ label: "static int twice(int x)", language: "java", code: "static int twice(int x) {\n  return x * 2;\n}", explanation: "Verdoppelt x." }] });
    expect(validateAnswerWithTools(value, { question: "Implementiere static int twice(int x)", locale: "de-DE" }, ["code_verifier"])).toBe(value);
  });

  it("rejects incomplete or missing requested methods", () => {
    const incomplete = answer({ glassesCodeUnits: [{ label: "twice", language: "java", code: "static int twice(int x) { return x * 2;", explanation: "Verdoppelt x." }] });
    expect(() => validateAnswerWithTools(incomplete, { question: "Implementiere static int twice(int x)", locale: "de-DE" }, ["code_verifier"])).toThrow("code_unit_incomplete");
  });

  it("rejects a wrong directly calculable result", () => {
    const value = answer({ glassesExercises: [{ label: "a)", labelSource: "document", sourceLatex: "2+2", resultLatex: "5", transformations: [] }] });
    expect(() => validateAnswerWithTools(value, { question: "Berechne 2+2", locale: "de-DE" }, ["calculator"])).toThrow("numeric_result_mismatch");
  });
});
