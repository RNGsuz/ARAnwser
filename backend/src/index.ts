import { config as loadDotEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { OpenAIVisionService } from "./openai-service.js";

// Resolve from this module so `npm --workspace backend` and direct starts load
// the same root configuration. The path works from both src/ and dist/.
loadDotEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const config = loadConfig();
const app = await buildApp(config, new OpenAIVisionService(config));

await app.listen({ port: config.PORT, host: "0.0.0.0" });
