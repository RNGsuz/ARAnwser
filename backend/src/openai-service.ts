import OpenAI, { toFile } from "openai";
import { answerSchema, glassesExerciseSchema, recognizedItemSchema, type Answer, type QueryInput, type VisionService } from "./types.js";
import type { Config } from "./config.js";
import { selectPipelinePolicy } from "./pipeline-policy.js";

export const outputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answerKind", "shortAnswer", "glassesSummary", "glassesExercises", "recognizedItems", "glassesCodeUnits", "discoveryInfo", "readingInfo", "solution", "spokenAnswer", "evidence", "confidence", "needsRetake", "retakeHint", "blocks"],
  properties: {
    answerKind: { type: "string", enum: ["discovery", "reading", "solution", "general"] },
    shortAnswer: { type: "string", minLength: 1, maxLength: 240 },
    glassesSummary: {
      type: "object",
      additionalProperties: false,
      required: ["format", "lines"],
      properties: {
        format: { type: "string", enum: ["text", "output"] },
        lines: { type: "array", minItems: 1, maxItems: 12, items: { type: "string", minLength: 1, maxLength: 80 } },
      },
    },
    glassesExercises: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "labelSource", "sourceLatex", "resultLatex", "transformations"],
        properties: {
          label: { type: "string", minLength: 1, maxLength: 80 },
          labelSource: { type: "string", enum: ["document", "generated"] },
          sourceLatex: { type: "string", minLength: 1, maxLength: 1000 },
          resultLatex: { type: "string", minLength: 1, maxLength: 500 },
          transformations: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["latex", "operation"],
              properties: {
                latex: { type: "string", minLength: 1, maxLength: 1000 },
                operation: { type: ["string", "null"], maxLength: 60 },
              },
            },
          },
        },
      },
    },
    recognizedItems: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "labelSource", "sourceLatex"],
        properties: {
          label: { type: "string", minLength: 1, maxLength: 80 },
          labelSource: { type: "string", enum: ["document", "generated"] },
          sourceLatex: { type: "string", minLength: 1, maxLength: 1000 },
        },
      },
    },
    glassesCodeUnits: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "language", "code", "explanation"],
        properties: {
          label: { type: "string", minLength: 1, maxLength: 160 },
          language: { type: "string", minLength: 1, maxLength: 40 },
          code: { type: "string", minLength: 1, maxLength: 4000 },
          explanation: { type: "string", minLength: 1, maxLength: 240 },
        },
      },
    },
    discoveryInfo: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["name", "category", "description", "facts", "alternatives", "safetyNote"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            category: { type: "string", minLength: 1, maxLength: 80 },
            description: { type: "string", minLength: 1, maxLength: 320 },
            facts: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 180 } },
            alternatives: { type: "array", maxItems: 3, items: { type: "string", minLength: 1, maxLength: 100 } },
            safetyNote: { type: ["string", "null"], minLength: 1, maxLength: 240 },
          },
        },
        { type: "null" },
      ],
    },
    readingInfo: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "summary", "recognizedText", "keyPoints", "visualFindings"],
          properties: {
            title: { type: ["string", "null"], minLength: 1, maxLength: 140 },
            summary: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", minLength: 1, maxLength: 240 } },
            recognizedText: { type: ["string", "null"], minLength: 1, maxLength: 6000 },
            keyPoints: { type: "array", maxItems: 6, items: { type: "string", minLength: 1, maxLength: 200 } },
            visualFindings: { type: "array", maxItems: 4, items: { type: "string", minLength: 1, maxLength: 200 } },
          },
        },
        { type: "null" },
      ],
    },
    solution: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "title", "steps"],
      properties: {
        kind: { type: "string", enum: ["math", "code", "document", "concept", "direct", "selection"] },
        title: { type: "string", minLength: 1, maxLength: 80 },
        steps: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "explanation", "contentType", "content", "language"],
            properties: {
              title: { type: "string", minLength: 1, maxLength: 60 },
              explanation: { type: "string", minLength: 1, maxLength: 240 },
              contentType: { type: "string", enum: ["text", "math", "code"] },
              content: { type: "string", minLength: 1, maxLength: 1600 },
              language: { type: ["string", "null"], maxLength: 40 },
            },
          },
        },
      },
    },
    spokenAnswer: { type: "string", minLength: 1, maxLength: 1600 },
    evidence: { type: "array", maxItems: 3, items: { type: "string", minLength: 1, maxLength: 320 } },
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
            properties: { type: { type: "string", const: "text" }, markdown: { type: "string", minLength: 1, maxLength: 4000 } },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "language", "code"],
            properties: {
              type: { type: "string", const: "code" },
              language: { type: "string", maxLength: 40 },
              code: { type: "string", minLength: 1, maxLength: 8000 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "latex", "displayMode"],
            properties: {
              type: { type: "string", const: "math" },
              latex: { type: "string", minLength: 1, maxLength: 2000 },
              displayMode: { type: "boolean" },
            },
          },
        ],
      },
    },
  },
} as const;

type AnswerIntent = NonNullable<QueryInput["intent"]>;

const commonOutputFields = ["answerKind", "shortAnswer", "glassesSummary", "spokenAnswer", "evidence", "confidence", "needsRetake", "retakeHint", "blocks"] as const;

export function outputJsonSchemaForIntent(intent: AnswerIntent = "solve", taskKind: "direct" | "math" | "code" = "direct") {
  const answerKind = intent === "discover" ? "discovery" : intent === "read" ? "reading" : intent === "solve" ? "solution" : "general";
  const specific = intent === "discover"
    ? ["discoveryInfo"]
    : intent === "read"
      ? ["readingInfo"]
      : intent === "solve"
        ? ["glassesExercises", "recognizedItems", "glassesCodeUnits", "solution"]
        : taskKind === "code"
          ? ["glassesCodeUnits", "solution"]
          : taskKind === "math"
            ? ["glassesExercises", "recognizedItems", "solution"]
            : ["solution"];
  const required = [...commonOutputFields, ...specific];
  const allProperties: Record<string, unknown> = outputJsonSchema.properties;
  const properties: Record<string, unknown> = Object.fromEntries(required.map((key) => [key, allProperties[key]]));
  properties.answerKind = { type: "string", const: answerKind };
  if (intent === "discover") properties.discoveryInfo = outputJsonSchema.properties.discoveryInfo.anyOf[0];
  if (intent === "read") properties.readingInfo = outputJsonSchema.properties.readingInfo.anyOf[0];
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties,
  } as const;
}

function normalizedPayload(payload: unknown, intent: AnswerIntent): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const source = payload as Record<string, unknown>;
  const answerKind = intent === "discover" ? "discovery" : intent === "read" ? "reading" : intent === "solve" ? "solution" : "general";
  return {
    ...source,
    answerKind: source.answerKind ?? answerKind,
    glassesExercises: source.glassesExercises ?? [],
    recognizedItems: source.recognizedItems ?? [],
    glassesCodeUnits: source.glassesCodeUnits ?? [],
    discoveryInfo: source.discoveryInfo ?? null,
    readingInfo: source.readingInfo ?? null,
    solution: source.solution ?? { kind: "direct", title: "Direkte Antwort", steps: [] },
  };
}

export function parseAnswerPayload(payload: unknown, intent: AnswerIntent = "solve"): Answer {
  const normalized = normalizedPayload(payload, intent);
  const parsed = answerSchema.safeParse(normalized);
  if (parsed.success) return parsed.data;
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) throw parsed.error;
  const source = normalized as Record<string, unknown>;
  const glassesExercises = Array.isArray(source.glassesExercises)
    ? source.glassesExercises.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const candidate = item as Record<string, unknown>;
      const transformations = Array.isArray(candidate.transformations)
        ? candidate.transformations.filter((step) => step && typeof step === "object" && !Array.isArray(step) && typeof (step as Record<string, unknown>).latex === "string" && ((step as Record<string, unknown>).latex as string).trim().length > 0)
        : [];
      const sanitized = glassesExerciseSchema.safeParse({ ...candidate, transformations });
      return sanitized.success ? [sanitized.data] : [];
    })
    : [];
  const recognizedItems = Array.isArray(source.recognizedItems)
    ? source.recognizedItems.flatMap((item) => {
      const sanitized = recognizedItemSchema.safeParse(item);
      return sanitized.success ? [sanitized.data] : [];
    })
    : [];
  const fallback = answerSchema.safeParse({ ...source, glassesExercises, recognizedItems });
  if (fallback.success) return fallback.data;
  throw parsed.error;
}

function instructionsForInput(input: QueryInput, intent: AnswerIntent, taskKind: "direct" | "math" | "code"): string {
  const answerKind = intent === "discover" ? "discovery" : intent === "read" ? "reading" : intent === "solve" ? "solution" : "general";
  const common = [
    `Set answerKind exactly to ${answerKind}. Answer in locale ${input.locale}.`,
    "Use previous context only for contextual follow-ups. Keep shortAnswer glanceable and spokenAnswer natural. Evidence has at most three brief supporting points.",
    "glassesSummary is the primary small-display result. Use complete short lines, readable Unicode, and no raw LaTeX commands, dollar delimiters, or begin/end environments.",
    "Build blocks in reading order: text for prose, code for source code, and math for LaTeX. Do not duplicate primary display content in blocks.",
  ];
  if (intent === "discover") return [...common,
    "The user selected object discovery. Identify and explain the main physical object, animal, plant, artwork, food, or scene. Do not treat writing as a worksheet or solve tasks unless explicitly asked. Be honest about ambiguity and request a better photo when responsible identification is impossible.",
    "discoveryInfo is required: likely name, short category, compact description, two to four non-repeating useful facts, plausible alternatives only when meaningful, and a safetyNote for plants, fungi, animals, foods, medicines, chemicals, tools, or similar risk. glassesSummary has exactly two complete lines: name, then an identifying description of at most 60 characters.",
  ].join(" ");
  if (intent === "read") return [...common,
    "The user selected reading and understanding. Analyze the visible slide, document, table, diagram, or sign and follow the requested action. Do not solve exercises unless explicitly requested. Preserve visible facts, labels, numbers, and order; distinguish textual claims from visual interpretation.",
    "readingInfo is required. title preserves the visible title or is null. summary has one to five complete statements. recognizedText contains original visible text only when transcription is requested, otherwise null. keyPoints contains important textual claims without duplication. visualFindings contains meaningful chart, table, layout, or other non-text findings. glassesSummary has at most four short lines.",
  ].join(" ");
  if (intent === "question") {
    const general = ["There is no photo. Set needsRetake=false and retakeHint=null."];
    if (taskKind === "code") general.push("For code implementation, create exactly one complete glassesCodeUnits item per requested method, helper, class, or test/main section, in requested order. label is the complete signature or precise section name. Include each declaration through its final closing brace. Never combine or split units. Keep solution.steps empty and do not repeat code in blocks.");
    else if (taskKind === "math") general.push("Solve and verify the mathematical question. Use generated labels only when needed. Put one glassesExercises item per answered part and preserve related labels from the question. Use compact transformations only when requested, and keep solution.steps empty when structured exercises are present.");
    else general.push("Answer directly. Use solution only when a short progressive explanation materially helps; otherwise use kind=direct with no steps.");
    return [...common, ...general].join(" ");
  }
  return [...common,
    "Answer only from the photographed task. Never invent unreadable or absent content. If evidence is insufficient, set needsRetake=true and give a concrete retake instruction.",
    "Treat related subquestions such as a), b), c) under one shared prompt as one exercise and answer all. If several independent exercises are visible and none was identified, enumerate them briefly and ask the user to choose.",
    "Preserve every visible exercise label verbatim and in document order, including 1), 150), a), Frage 2), Aufgabe 7a, or Roman numerals. Generate a label only when none is visible and mark labelSource=generated.",
    "For math, create one glassesExercises and recognizedItems entry per answered exercise. Use LaTeX only in Latex fields without delimiters or boxed environments. Do not duplicate derivations in solution.steps.",
    input.includeSteps === false
      ? "The user disabled solution paths: every transformations array is empty. Keep results and recognized items."
      : "The user enabled solution paths: each exercise has at most six compact mathematical states from original to final result. Each entry is one state; operation is null first and otherwise one short unambiguous action. Do not chain states with implication arrows.",
    "For code implementation, put exactly one complete requested method, helper, class, or test/main section in each glassesCodeUnits item, in requested order. Each code value includes its declaration through the final closing brace. Never combine or split units. Keep solution.steps empty and do not repeat code in blocks or evidence.",
    "For code tracing rather than implementation, leave glassesCodeUnits empty and use one concise solution step per relevant execution stage. For other task types use solution only when it adds learning value.",
    "Solve and verify before writing result fields. shortAnswer, glassesSummary, structured units, spokenAnswer, evidence, and blocks must agree.",
  ].join(" ");
}

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
    const policy = selectPipelinePolicy(input, {
      defaultModel: this.config.OPENAI_VISION_MODEL,
      fastModel: this.config.OPENAI_FAST_MODEL,
      reasoningModel: this.config.OPENAI_REASONING_MODEL,
    });
    const intent = policy.intent;
    const hasImage = Boolean(input.image && input.imageMimeType);
    const previousContext = input.previousQuestion && input.previousAnswer
      ? `Previous question: ${input.previousQuestion}\nPrevious answer: ${input.previousAnswer}\n\n`
      : "";
    const content: Array<Record<string, unknown>> = [{
      type: "input_text",
      text: hasImage && policy.allowedTools.includes("ocr") && input.ocrText
        ? `${previousContext}Current question: ${input.question}\n\nLocal OCR (may contain errors):\n${input.ocrText}`
        : `${previousContext}Current question: ${input.question}`,
    }];
    if (input.image && input.imageMimeType) {
      content.push({
        type: "input_image",
        image_url: `data:${input.imageMimeType};base64,${input.image.toString("base64")}`,
        detail: policy.imageDetail,
      });
    }
    const response = await this.client.responses.create({
      model: policy.model,
      store: false,
      reasoning: { effort: policy.reasoningEffort },
      instructions: instructionsForInput(input, intent, policy.taskKind),
      input: [{
        role: "user",
        content: content as never,
      }],
      text: {
        format: {
          type: "json_schema",
          name: "document_answer",
          strict: true,
          schema: outputJsonSchemaForIntent(intent, policy.taskKind),
        },
      },
      max_output_tokens: policy.maxOutputTokens,
    });

    if (response.status === "incomplete") throw new Error("ai_response_incomplete");
    try {
      return parseAnswerPayload(JSON.parse(response.output_text), intent);
    } catch (cause) {
      throw new Error("ai_response_invalid", { cause });
    }
  }
}
