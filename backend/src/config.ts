import { z } from "zod";

const schema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_VISION_MODEL: z.string().default("gpt-5.6-luna"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-transcribe"),
  CLIENT_TOKEN: z.string().min(16).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(600),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MAX_AUDIO_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  DAILY_QUERY_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
