import { describe, expect, it } from "vitest";
import { answerSchema } from "./types.js";

describe("structured answer schema", () => {
  it("accepts ordered text, code, and math blocks", () => {
    const result = answerSchema.parse({
      shortAnswer: "Drei Darstellungen",
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
  });

  it("rejects an unknown display block", () => {
    expect(() => answerSchema.parse({
      shortAnswer: "Test",
      spokenAnswer: "Test",
      evidence: [],
      confidence: 1,
      needsRetake: false,
      retakeHint: null,
      blocks: [{ type: "html", value: "<b>unsafe</b>" }],
    })).toThrow();
  });
});
