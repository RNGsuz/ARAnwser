import { describe, expect, it } from "vitest";
import { outputJsonSchema, parseAnswerPayload } from "./openai-service.js";
import { answerSchema } from "./types.js";

describe("structured answer schema", () => {
  it("accepts ordered text, code, and math blocks", () => {
    const result = answerSchema.parse({
      shortAnswer: "Drei Darstellungen",
      glassesSummary: { format: "output", lines: ["Frage 150) 3", "b) \"ABC\""] },
      glassesExercises: [{ label: "Frage 150)", labelSource: "document", sourceLatex: "1+2", resultLatex: "3", transformations: [{ latex: "1+2", operation: null }, { latex: "3", operation: "addieren" }] }],
      recognizedItems: [{ label: "Frage 150)", labelSource: "document", sourceLatex: "1+2" }],
      glassesCodeUnits: [],
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
      glassesCodeUnits: [],
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
      glassesCodeUnits: [],
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

  it("aligns non-empty string constraints and drops only malformed math display items", () => {
    expect(outputJsonSchema.properties.glassesExercises.items.properties.label.minLength).toBe(1);
    const result = parseAnswerPayload({
      shortAnswer: "x = 1",
      glassesSummary: { format: "output", lines: ["a) x = 1"] },
      glassesExercises: [{ label: "", labelSource: "document", sourceLatex: "3(x-1)+2=2x", resultLatex: "x=1", transformations: [] }],
      recognizedItems: [{ label: "a)", labelSource: "document", sourceLatex: "3(x-1)+2=2x" }],
      glassesCodeUnits: [],
      solution: { kind: "direct", title: "Diagnose", steps: [] },
      spokenAnswer: "x ist eins.", evidence: [], confidence: 1, needsRetake: false, retakeHint: null,
      blocks: [{ type: "text", markdown: "x = 1" }],
    });
    expect(result.glassesExercises).toEqual([]);
    expect(result.recognizedItems[0]?.label).toBe("a)");
  });

  it("accepts a complete method as one semantic code unit", () => {
    const method = `static int sum(int[] values) {\n${"  int total = 0;\n".repeat(40)}  return total;\n}`;
    expect(method.length).toBeGreaterThan(600);
    const result = answerSchema.parse({
      shortAnswer: "Methode implementiert",
      glassesSummary: { format: "text", lines: ["sum(...) implementiert"] },
      glassesExercises: [],
      recognizedItems: [],
      glassesCodeUnits: [{ label: "static int sum(int[] values)", language: "java", code: method, explanation: "Summiert die Werte." }],
      solution: { kind: "code", title: "Implementierung", steps: [] },
      spokenAnswer: "Die Methode summiert alle Werte.", evidence: [], confidence: 1,
      needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Die Laufzeit ist linear." }],
    });
    expect(result.glassesCodeUnits[0]?.code).toBe(method);
  });

  it("keeps several complete code units in requested order", () => {
    const methods = ["first", "second", "third"].map((name) => ({
      label: `static void ${name}()`, language: "java", code: `static void ${name}() {\n  System.out.println(\"${name}\");\n}`, explanation: `${name} ausführen.`,
    }));
    const result = answerSchema.parse({
      shortAnswer: "Drei Methoden implementiert", glassesSummary: { format: "text", lines: ["3 Methoden vollständig"] },
      glassesExercises: [], recognizedItems: [], glassesCodeUnits: methods,
      solution: { kind: "code", title: "Implementierung", steps: [] }, spokenAnswer: "Drei Methoden wurden implementiert.",
      evidence: [], confidence: 1, needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Laufzeit konstant." }],
    });
    expect(result.glassesCodeUnits.map((unit) => unit.label)).toEqual(methods.map((unit) => unit.label));
    expect(result.glassesCodeUnits.every((unit) => unit.code.endsWith("}"))).toBe(true);
  });
});
