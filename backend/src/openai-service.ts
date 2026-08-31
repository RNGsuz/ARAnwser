import OpenAI, { toFile } from "openai";
import { answerSchema, type Answer, type QueryInput, type VisionService } from "./types.js";
import type { Config } from "./config.js";

export const outputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shortAnswer", "glassesSummary", "solution", "spokenAnswer", "evidence", "confidence", "needsRetake", "retakeHint", "blocks"],
  properties: {
    shortAnswer: { type: "string", maxLength: 240 },
    glassesSummary: {
      type: "object",
      additionalProperties: false,
      required: ["format", "lines"],
      properties: {
        format: { type: "string", enum: ["text", "output"] },
        lines: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", maxLength: 80 } },
      },
    },
    solution: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "steps"],
      properties: {
        kind: { type: "string", enum: ["math", "code", "document", "concept", "direct", "selection"] },
        title: { type: "string", maxLength: 80 },
        steps: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "explanation", "contentType", "content", "language"],
            properties: {
              title: { type: "string", maxLength: 60 },
              explanation: { type: "string", maxLength: 240 },
              contentType: { type: "string", enum: ["text", "math", "code"] },
              content: { type: "string", maxLength: 600 },
              language: { type: ["string", "null"], maxLength: 40 },
            },
          },
        },
      },
    },
    spokenAnswer: { type: "string", maxLength: 1600 },
    evidence: { type: "array", maxItems: 3, items: { type: "string", maxLength: 320 } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needsRetake: { type: "boolean" },
    retakeHint: { type: ["string", "null"], maxLength: 240 },
    blocks: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "markdown"],
            properties: { type: { type: "string", const: "text" }, markdown: { type: "string", maxLength: 4000 } },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "language", "code"],
            properties: {
              type: { type: "string", const: "code" },
              language: { type: "string", maxLength: 40 },
              code: { type: "string", maxLength: 8000 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "latex", "displayMode"],
            properties: {
              type: { type: "string", const: "math" },
              latex: { type: "string", maxLength: 2000 },
              displayMode: { type: "boolean" },
            },
          },
        ],
      },
    },
  },
} as const;

export class OpenAIVisionService implements VisionService {
  private readonly client: OpenAI;

  constructor(private readonly config: Config) {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  async transcribe(audio: Buffer, filename: string, mimeType: string): Promise<string> {
    const result = await this.client.audio.transcriptions.create({
      file: await toFile(audio, filename, { type: mimeType }),
      model: this.config.OPENAI_TRANSCRIBE_MODEL,
      response_format: "text",
    });
    return typeof result === "string" ? result.trim() : String(result).trim();
  }

  async answer(input: QueryInput): Promise<Answer> {
    const hasImage = Boolean(input.image && input.imageMimeType);
    const previousContext = input.previousQuestion && input.previousAnswer
      ? `Previous question: ${input.previousQuestion}\nPrevious answer: ${input.previousAnswer}\n\n`
      : "";
    const content: Array<Record<string, unknown>> = [{
      type: "input_text",
      text: hasImage
        ? `${previousContext}Current question: ${input.question}\n\nLocal OCR (may contain errors):\n${input.ocrText || "[no OCR text]"}`
        : `${previousContext}Current question: ${input.question}`,
    }];
    if (input.image && input.imageMimeType) {
      content.push({
        type: "input_image",
        image_url: `data:${input.imageMimeType};base64,${input.image.toString("base64")}`,
        detail: "high",
      });
    }
    const response = await this.client.responses.create({
      model: this.config.OPENAI_VISION_MODEL,
      store: false,
      reasoning: { effort: "low" },
      instructions: [
        hasImage
          ? "Answer only from the photographed document or slide. Never invent unreadable or absent content. If evidence is insufficient, set needsRetake=true and explain how to improve the photo."
          : "Answer the general question directly. There is no photo to inspect, so always set needsRetake=false and retakeHint=null.",
        hasImage ? "Treat related subquestions such as a), b), and c) under one shared prompt as one exercise and answer all of them unless the user asks for only one." : "",
        hasImage ? "If the image instead contains several independent exercises on a book or worksheet page and the user did not identify one, do not choose arbitrarily: briefly enumerate them and ask which one to solve." : "",
        "Use the previous exchange only to resolve contextual follow-ups. Keep shortAnswer glanceable. spokenAnswer may explain more. Evidence contains up to three brief supporting points.",
        "glassesSummary is the result-only view for a small display. For related subquestions, create exactly one concise line per requested part and preserve labels such as a), b), and c). Do not add reasoning, introductions, raw LaTeX commands, dollar delimiters, or environments such as begin/end to these lines; use readable Unicode symbols where useful. Quote string results and write numbers, booleans, and null explicitly. Set format=output for program output, exact result lists, or labeled exercise answers; otherwise use format=text. For a normal single question, use one to three short lines.",
        "Use solution as a progressive learning path after the result. For math, use kind=math and one meaningful transformation per step with LaTeX in content. For code, use kind=code and show the relevant execution or reasoning stages, using exact code/output where helpful. For document questions, use kind=document and progress from the relevant passage to its interpretation. For conceptual questions, use kind=concept and progress from the key idea to the reason or consequence. Use kind=selection when asking the user to choose an independent exercise. Use kind=direct and zero steps only when steps add no learning value. Keep every step independently understandable, concise, and free of invented evidence. language is only set for code content and null otherwise.",
        "Build blocks in reading order. Use text blocks for prose and limited Markdown, code blocks for source code with its language, and math blocks for LaTeX. Never put code or display mathematics into a text block.",
        "spokenAnswer must verbalize formulas and code naturally instead of reading raw LaTeX or punctuation.",
        `Answer in locale ${input.locale}.`,
      ].join(" "),
      input: [{
        role: "user",
        content: content as never,
      }],
      text: {
        format: {
          type: "json_schema",
          name: "document_answer",
          strict: true,
          schema: outputJsonSchema,
        },
      },
      max_output_tokens: 1400,
    });

    return answerSchema.parse(JSON.parse(response.output_text));
  }
}
