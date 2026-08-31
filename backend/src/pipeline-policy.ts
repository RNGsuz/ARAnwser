import type { QueryInput } from "./types.js";

export type PipelineTool = "ocr" | "calculator" | "code_verifier" | "web_search";

export interface PipelinePolicy {
  intent: NonNullable<QueryInput["intent"]>;
  taskKind: "direct" | "math" | "code";
  model: string;
  reasoningEffort: "low" | "medium";
  maxOutputTokens: number;
  imageDetail: "auto" | "high";
  allowedTools: PipelineTool[];
}

const codeQuestion = /\b(code|java|python|typescript|javascript|methode|method|klasse|class|implement|programm)\b/i;
const mathQuestion = /[=+*/^]|\b(mathe|gleichung|median|mittelwert|summe|integral|bruch|berechne|calculate)\b/i;
const currentInformation = /\b(aktuell|derzeit|heute|neueste[nsr]?|momentan|preis|kostet|öffnungszeiten|geöffnet|verfügbar|verfügbarkeit|dieses\s+jahr|current|today|latest|price|opening\s+hours|available|availability)\b/i;

export function needsCurrentInformation(question: string): boolean {
  return currentInformation.test(question);
}

export function selectPipelinePolicy(
  input: QueryInput,
  models: { defaultModel: string; fastModel?: string; reasoningModel?: string },
): PipelinePolicy {
  const intent = input.intent ?? (input.image ? "solve" : "question");
  const webTools: PipelineTool[] = needsCurrentInformation(input.question) ? ["web_search"] : [];
  if (intent === "discover") return {
    intent, taskKind: "direct", model: models.fastModel || models.defaultModel, reasoningEffort: "low", maxOutputTokens: 900, imageDetail: "auto", allowedTools: webTools,
  };
  if (intent === "read") return {
    intent, taskKind: "direct", model: models.fastModel || models.defaultModel, reasoningEffort: "low", maxOutputTokens: 1600, imageDetail: "high", allowedTools: ["ocr", ...webTools],
  };
  const isCode = codeQuestion.test(input.question);
  const isMath = mathQuestion.test(input.question);
  if (intent === "question") return {
    intent,
    taskKind: isCode ? "code" : isMath ? "math" : "direct",
    model: isCode || isMath ? models.reasoningModel || models.defaultModel : models.fastModel || models.defaultModel,
    reasoningEffort: isCode ? "medium" : "low",
    maxOutputTokens: isCode ? 5000 : isMath ? 2500 : 1600,
    imageDetail: "auto",
    allowedTools: [...(isCode ? ["code_verifier" as const] : []), ...(isMath ? ["calculator" as const] : []), ...webTools],
  };
  return {
    intent,
    taskKind: isCode ? "code" : isMath ? "math" : "direct",
    model: isCode || isMath ? models.reasoningModel || models.defaultModel : models.defaultModel,
    reasoningEffort: isCode ? "medium" : "low",
    maxOutputTokens: isCode ? 5000 : 3000,
    imageDetail: "high",
    allowedTools: ["ocr", "calculator", "code_verifier", ...webTools],
  };
}
