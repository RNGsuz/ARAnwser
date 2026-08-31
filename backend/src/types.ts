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

export const answerSchema = z.object({
  shortAnswer: z.string().min(1).max(240),
  glassesSummary: z.object({
    format: z.enum(["text", "output"]),
    lines: z.array(z.string().min(1).max(80)).min(1).max(12),
  }),
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
}

export interface VisionService {
  transcribe(audio: Buffer, filename: string, mimeType: string): Promise<string>;
  answer(input: QueryInput): Promise<Answer>;
}
