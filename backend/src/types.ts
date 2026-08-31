import { z } from "zod";

export const answerBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), markdown: z.string().min(1).max(4000) }),
  z.object({ type: z.literal("code"), language: z.string().max(40), code: z.string().min(1).max(8000) }),
  z.object({ type: z.literal("math"), latex: z.string().min(1).max(2000), displayMode: z.boolean() }),
]);

export const solutionStepSchema = z.object({
  title: z.string().min(1).max(60),
  explanation: z.string().min(1).max(240),
  contentType: z.enum(["text", "math", "code"]),
  content: z.string().min(1).max(1600),
  language: z.string().max(40).nullable(),
});

const labelSourceSchema = z.enum(["document", "generated"]);

export const glassesExerciseSchema = z.object({
  label: z.string().min(1).max(80),
  labelSource: labelSourceSchema,
  sourceLatex: z.string().min(1).max(1000),
  resultLatex: z.string().min(1).max(500),
  transformations: z.array(z.object({
    latex: z.string().min(1).max(1000),
    operation: z.string().max(60).nullable(),
  })).max(6),
});

export const recognizedItemSchema = z.object({
  label: z.string().min(1).max(80),
  labelSource: labelSourceSchema,
  sourceLatex: z.string().min(1).max(1000),
});

export const glassesCodeUnitSchema = z.object({
  label: z.string().min(1).max(160),
  language: z.string().min(1).max(40),
  code: z.string().min(1).max(4000),
  explanation: z.string().min(1).max(240),
});

export const discoveryInfoSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(320),
  facts: z.array(z.string().min(1).max(180)).min(1).max(4),
  alternatives: z.array(z.string().min(1).max(100)).max(3),
  safetyNote: z.string().min(1).max(240).nullable(),
});

export const readingInfoSchema = z.object({
  title: z.string().min(1).max(140).nullable(),
  summary: z.array(z.string().min(1).max(240)).min(1).max(5),
  recognizedText: z.string().min(1).max(6000).nullable(),
  keyPoints: z.array(z.string().min(1).max(200)).max(6),
  visualFindings: z.array(z.string().min(1).max(200)).max(4),
});

export const modeSuggestionSchema = z.object({
  suggestedMode: z.enum(["discover", "read", "solve", "question"]),
  reason: z.string().min(1).max(180),
  confidence: z.number().min(0.9).max(1),
});

export const visualModeClassificationSchema = z.object({
  suggestedMode: z.enum(["discover", "read", "solve"]),
  reason: z.string().min(1).max(180),
  confidence: z.number().min(0).max(1),
});

export type VisualModeClassification = z.infer<typeof visualModeClassificationSchema>;

export const answerSchema = z.object({
  answerKind: z.enum(["discovery", "reading", "solution", "general"]),
  modeSuggestion: modeSuggestionSchema.nullable().default(null),
  shortAnswer: z.string().min(1).max(240),
  glassesSummary: z.object({
    format: z.enum(["text", "output"]),
    lines: z.array(z.string().min(1).max(80)).min(1).max(12),
  }),
  glassesExercises: z.array(glassesExerciseSchema).max(12),
  recognizedItems: z.array(recognizedItemSchema).max(12),
  glassesCodeUnits: z.array(glassesCodeUnitSchema).max(12),
  discoveryInfo: discoveryInfoSchema.nullable(),
  readingInfo: readingInfoSchema.nullable(),
  solution: z.object({
    kind: z.enum(["math", "code", "document", "concept", "direct", "selection"]),
    title: z.string().min(1).max(80),
    steps: z.array(solutionStepSchema).max(8),
  }),
  spokenAnswer: z.string().min(1).max(1600),
  evidence: z.array(z.string().min(1).max(320)).max(3),
  confidence: z.number().min(0).max(1),
  needsRetake: z.boolean(),
  retakeHint: z.string().max(240).nullable(),
  blocks: z.array(answerBlockSchema).min(1).max(12),
});

export type Answer = z.infer<typeof answerSchema>;

export interface QueryInput {
  image?: Buffer;
  imageMimeType?: string;
  question: string;
  ocrText?: string;
  locale: string;
  previousQuestion?: string;
  previousAnswer?: string;
  includeSteps?: boolean;
  intent?: "solve" | "discover" | "read" | "question";
  isFollowUp?: boolean;
  imageResent?: boolean;
}

export interface VisionService {
  transcribe(audio: Buffer, filename: string, mimeType: string): Promise<string>;
  classify(image: Buffer, mimeType: string, locale: string): Promise<VisualModeClassification>;
  answer(input: QueryInput): Promise<Answer>;
}
