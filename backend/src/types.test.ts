import { describe, expect, it } from "vitest";
import { outputJsonSchema } from "./openai-service.js";
import { answerSchema } from "./types.js";

describe("structured answer schema", () => {
  it("accepts ordered text, code, and math blocks", () => {
    const result = answerSchema.parse({
      shortAnswer: "Drei Darstellungen",
      glassesSummary: { format: "output", lines: ["Frage 150) 3", "b) \"ABC\""] },
      glassesExercises: [{ label: "Frage 150)", labelSource: "document", sourceLatex: "1+2", resultLatex: "3", transformations: [{ latex: "1+2", operation: null }, { latex: "3", operation: "addieren" }] }],
      recognizedItems: [{ label: "Frage 150)", labelSource: "document", sourceLatex: "1+2" }],
      solution: { kind: "math", title: "Lösungsweg", steps: [{ title: "Summieren", explanation: "Die Terme werden addiert.", contentType: "math", content: "1 + 2 = 3", language: null }] },
      spokenAnswer: "Die Antwort enthält erklärenden Text, Programmcode und eine mathematische Formel.",
      evidence: [],
      confidence: 0.98,
      needsRetake: false,
      retakeHint: null,
      blocks: [
        { type: "text", markdown: "## Erklärung\nDas ist **wichtig**." },
        { type: "code", language: "typescript", code: "const answer = 42;" },
        { type: "math", latex: "\\sum_{i=1}^{n} \\frac{1}{i}", displayMode: true },
      ],
    });
    expect(result.blocks.map((block) => block.type)).toEqual(["text", "code", "math"]);
    expect(result.glassesSummary.lines).toEqual(["Frage 150) 3", "b) \"ABC\""]);
    expect(result.glassesExercises[0]?.label).toBe("Frage 150)");
  });

  it("rejects an unknown display block", () => {
    expect(() => answerSchema.parse({
      shortAnswer: "Test",
      glassesSummary: { format: "text", lines: ["Test"] },
      glassesExercises: [],
      recognizedItems: [],
      solution: { kind: "direct", title: "Direkte Antwort", steps: [] },
      spokenAnswer: "Test",
      evidence: [],
      confidence: 1,
      needsRetake: false,
      retakeHint: null,
      blocks: [{ type: "html", value: "<b>unsafe</b>" }],
    })).toThrow();
  });

  it("rejects empty glasses summaries", () => {
    expect(() => answerSchema.parse({
      shortAnswer: "Test",
      glassesSummary: { format: "output", lines: [] },
      glassesExercises: [],
      recognizedItems: [],
      solution: { kind: "direct", title: "Direkte Antwort", steps: [] },
      spokenAnswer: "Test",
      evidence: [],
      confidence: 1,
      needsRetake: false,
      retakeHint: null,
      blocks: [{ type: "text", markdown: "Test" }],
    })).toThrow();
  });

  it("declares a JSON type for every structured-output discriminator", () => {
    const variants = outputJsonSchema.properties.blocks.items.anyOf;
    expect(variants.map((variant) => variant.properties.type.type)).toEqual(["string", "string", "string"]);
  });

  it("accepts a complete method as one semantic code unit", () => {
    const method = `static int sum(int[] values) {\n${"  int total = 0;\n".repeat(40)}  return total;\n}`;
    expect(method.length).toBeGreaterThan(600);
    const result = answerSchema.parse({
      shortAnswer: "Methode implementiert",
      glassesSummary: { format: "text", lines: ["sum(...) implementiert"] },
      glassesExercises: [],
      recognizedItems: [],
      solution: { kind: "code", title: "Implementierung", steps: [{ title: "sum", explanation: "Summiert die Werte.", contentType: "code", content: method, language: "java" }] },
      spokenAnswer: "Die Methode summiert alle Werte.", evidence: [], confidence: 1,
      needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Die Laufzeit ist linear." }],
    });
    expect(result.solution.steps[0]?.content).toBe(method);
  });
});
