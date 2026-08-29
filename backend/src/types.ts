import { z } from "zod";

export const answerSchema = z.object({
  shortAnswer: z.string().min(1).max(240),
  spokenAnswer: z.string().min(1).max(1600),
  evidence: z.array(z.string().min(1).max(320)).max(3),
  confidence: z.number().min(0).max(1),
  needsRetake: z.boolean(),
  retakeHint: z.string().max(240).nullable(),
});

export type Answer = z.infer<typeof answerSchema>;

export interface QueryInput {
  image: Buffer;
  imageMimeType: string;
  question: string;
  ocrText: string;
  locale: string;
}

export interface VisionService {
  transcribe(audio: Buffer, filename: string, mimeType: string): Promise<string>;
  answer(input: QueryInput): Promise<Answer>;
}

