import { describe, expect, it } from "vitest";
import { outputJsonSchema, outputJsonSchemaForIntent, parseAnswerPayload, parseVisualModeClassification } from "./openai-service.js";
import { answerSchema } from "./types.js";

describe("structured answer schema", () => {
  it("routes informational slides to reading unless an explicit task is visible", () => {
    expect(parseVisualModeClassification({
      contentType: "informational_content", taskEvidence: null,
      reason: "Die Folie nennt Voraussetzungen und Grenzen des Recyclings.", confidence: 0.98,
    }).suggestedMode).toBe("read");
    expect(parseVisualModeClassification({
      contentType: "explicit_task", taskEvidence: "Berechne den Median.",
      reason: "Eine konkrete Arbeitsanweisung ist sichtbar.", confidence: 0.96,
    }).suggestedMode).toBe("solve");
  });

  it("accepts privacy-safe pipeline diagnostics without making them model output fields", () => {
    const parsed = answerSchema.parse({
      answerKind: "general", shortAnswer: "Vier", glassesSummary: { format: "text", lines: ["4"] },
      glassesExercises: [], recognizedItems: [], glassesCodeUnits: [], discoveryInfo: null, readingInfo: null,
      solution: { kind: "direct", title: "Antwort", steps: [] }, spokenAnswer: "Vier.", evidence: [], confidence: 1,
      needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "4" }],
      diagnostics: { routingModel: "router-model", answerModel: "answer-model", reasoningEffort: "low", imageDetail: null, toolsOffered: ["calculator"], toolsUsed: ["calculator"] },
    });
    expect(parsed.diagnostics?.answerModel).toBe("answer-model");
    expect(outputJsonSchema.properties).not.toHaveProperty("diagnostics");
  });

  it("does not auto-route an alleged task without visible task evidence", () => {
    expect(parseVisualModeClassification({
      contentType: "explicit_task", taskEvidence: null,
      reason: "Die Folie enthält Formeln.", confidence: 0.97,
    })).toEqual({ suggestedMode: "read", reason: "Die Folie enthält Formeln.", confidence: 0.89 });
  });

  it("accepts ordered text, code, and math blocks", () => {
    const result = answerSchema.parse({
      answerKind: "solution",
      shortAnswer: "Drei Darstellungen",
      glassesSummary: { format: "output", lines: ["Frage 150) 3", "b) \"ABC\""] },
      glassesExercises: [{ label: "Frage 150)", labelSource: "document", sourceLatex: "1+2", resultLatex: "3", transformations: [{ latex: "1+2", operation: null }, { latex: "3", operation: "addieren" }] }],
      recognizedItems: [{ label: "Frage 150)", labelSource: "document", sourceLatex: "1+2" }],
      glassesCodeUnits: [],
      discoveryInfo: null,
      readingInfo: null,
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
      answerKind: "general",
      shortAnswer: "Test",
      glassesSummary: { format: "text", lines: ["Test"] },
      glassesExercises: [],
      recognizedItems: [],
      glassesCodeUnits: [],
      discoveryInfo: null,
      readingInfo: null,
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
      answerKind: "general",
      shortAnswer: "Test",
      glassesSummary: { format: "output", lines: [] },
      glassesExercises: [],
      recognizedItems: [],
      glassesCodeUnits: [],
      discoveryInfo: null,
      readingInfo: null,
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

  it("offers only mode-specific fields to structured outputs", () => {
    expect(Object.keys(outputJsonSchemaForIntent("discover").properties)).toEqual([
      "answerKind", "modeSuggestion", "shortAnswer", "glassesSummary", "spokenAnswer", "evidence", "confidence", "needsRetake", "retakeHint", "blocks", "discoveryInfo",
    ]);
    expect(Object.keys(outputJsonSchemaForIntent("read").properties)).not.toContain("glassesCodeUnits");
    expect(Object.keys(outputJsonSchemaForIntent("question").properties)).not.toContain("readingInfo");
  });

  it("normalizes a compact discovery response for existing clients", () => {
    const result = parseAnswerPayload({
      answerKind: "discovery", shortAnswer: "Walnuss", glassesSummary: { format: "text", lines: ["Walnuss", "Essbarer Samen"] },
      discoveryInfo: { name: "Walnuss", category: "Lebensmittel", description: "Ein essbarer Samen.", facts: ["Enthält ungesättigte Fettsäuren."], alternatives: [], safetyNote: null },
      spokenAnswer: "Das ist eine Walnuss.", evidence: [], confidence: 0.9, needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Walnuss" }],
    }, "discover");
    expect(result.glassesExercises).toEqual([]);
    expect(result.readingInfo).toBeNull();
    expect(result.solution.steps).toEqual([]);
  });

  it("accepts only high-confidence non-binding mode suggestions", () => {
    const compact = {
      answerKind: "discovery", shortAnswer: "Arbeitsblatt", glassesSummary: { format: "text", lines: ["Arbeitsblatt"] },
      discoveryInfo: { name: "Arbeitsblatt", category: "Dokument", description: "Eine sichtbare Rechenaufgabe.", facts: ["Enthält eine Gleichung."], alternatives: [], safetyNote: null },
      spokenAnswer: "Das Foto zeigt wahrscheinlich eine Aufgabe.", evidence: [], confidence: 0.95, needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Arbeitsblatt" }],
    };
    expect(parseAnswerPayload({ ...compact, modeSuggestion: { suggestedMode: "solve", reason: "Eine klare Gleichung ist sichtbar.", confidence: 0.95 } }, "discover").modeSuggestion?.suggestedMode).toBe("solve");
    expect(() => parseAnswerPayload({ ...compact, modeSuggestion: { suggestedMode: "solve", reason: "Vielleicht eine Aufgabe.", confidence: 0.7 } }, "discover")).toThrow();
  });

  it("aligns non-empty string constraints and drops only malformed math display items", () => {
    expect(outputJsonSchema.properties.glassesExercises.items.properties.label.minLength).toBe(1);
    const result = parseAnswerPayload({
      answerKind: "solution",
      shortAnswer: "x = 1",
      glassesSummary: { format: "output", lines: ["a) x = 1"] },
      glassesExercises: [{ label: "", labelSource: "document", sourceLatex: "3(x-1)+2=2x", resultLatex: "x=1", transformations: [] }],
      recognizedItems: [{ label: "a)", labelSource: "document", sourceLatex: "3(x-1)+2=2x" }],
      glassesCodeUnits: [],
      discoveryInfo: null,
      readingInfo: null,
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
      answerKind: "solution",
      shortAnswer: "Methode implementiert",
      glassesSummary: { format: "text", lines: ["sum(...) implementiert"] },
      glassesExercises: [],
      recognizedItems: [],
      glassesCodeUnits: [{ label: "static int sum(int[] values)", language: "java", code: method, explanation: "Summiert die Werte." }],
      discoveryInfo: null,
      readingInfo: null,
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
      answerKind: "solution",
      shortAnswer: "Drei Methoden implementiert", glassesSummary: { format: "text", lines: ["3 Methoden vollständig"] },
      glassesExercises: [], recognizedItems: [], glassesCodeUnits: methods,
      discoveryInfo: null,
      readingInfo: null,
      solution: { kind: "code", title: "Implementierung", steps: [] }, spokenAnswer: "Drei Methoden wurden implementiert.",
      evidence: [], confidence: 1, needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Laufzeit konstant." }],
    });
    expect(result.glassesCodeUnits.map((unit) => unit.label)).toEqual(methods.map((unit) => unit.label));
    expect(result.glassesCodeUnits.every((unit) => unit.code.endsWith("}"))).toBe(true);
  });

  it("accepts a structured discovery infobox", () => {
    const result = answerSchema.parse({
      answerKind: "discovery",
      shortAnswer: "Eine Walnuss", glassesSummary: { format: "text", lines: ["Walnuss", "Botanisch eine Steinfrucht"] },
      glassesExercises: [], recognizedItems: [], glassesCodeUnits: [],
      discoveryInfo: { name: "Walnuss", category: "Lebensmittel", description: "Der essbare Samen des Walnussbaums.", facts: ["Reich an ungesättigten Fettsäuren.", "Botanisch keine echte Nuss."], alternatives: [], safetyNote: "Bei Nussallergie nicht verzehren." },
      readingInfo: null,
      solution: { kind: "direct", title: "Entdeckt", steps: [] }, spokenAnswer: "Das ist wahrscheinlich eine Walnuss.",
      evidence: [], confidence: 0.95, needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Walnuss" }],
    });
    expect(result.discoveryInfo?.facts).toHaveLength(2);
  });

  it("accepts a structured reading response", () => {
    const result = answerSchema.parse({
      answerKind: "reading",
      shortAnswer: "Die Folie erklärt Photosynthese.", glassesSummary: { format: "text", lines: ["Photosynthese", "Licht wird in chemische Energie umgewandelt."] },
      glassesExercises: [], recognizedItems: [], glassesCodeUnits: [], discoveryInfo: null,
      readingInfo: { title: "Photosynthese", summary: ["Pflanzen wandeln Lichtenergie um."], recognizedText: null, keyPoints: ["Chlorophyll absorbiert Licht."], visualFindings: ["Ein Pfeildiagramm zeigt den Stofffluss."] },
      solution: { kind: "document", title: "Zusammenfassung", steps: [] }, spokenAnswer: "Die Folie erklärt Photosynthese.",
      evidence: [], confidence: 0.96, needsRetake: false, retakeHint: null, blocks: [{ type: "text", markdown: "Photosynthese" }],
    });
    expect(result.readingInfo?.title).toBe("Photosynthese");
  });
});
