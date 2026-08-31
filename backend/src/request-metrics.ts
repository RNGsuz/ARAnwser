import type OpenAI from "openai";
import type { PipelinePolicy, PipelineTool } from "./pipeline-policy.js";

export interface RequestMetrics {
  event: "ai_request_metrics";
  intent: PipelinePolicy["intent"];
  taskKind: PipelinePolicy["taskKind"];
  model: string;
  toolsOffered: PipelineTool[];
  toolsUsed: PipelineTool[];
  imageDetail: PipelinePolicy["imageDetail"] | null;
  imageResent: boolean;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  failureCode: string | null;
}

export function buildRequestMetrics(args: {
  policy: PipelinePolicy;
  response?: OpenAI.Responses.Response;
  imageIncluded: boolean;
  imageResent: boolean;
  localToolsUsed?: PipelineTool[];
  latencyMs: number;
  success: boolean;
  failureCode?: string;
}): RequestMetrics {
  const webUsed = args.response?.output.some((item) => item.type === "web_search_call") ? ["web_search" as const] : [];
  return {
    event: "ai_request_metrics",
    intent: args.policy.intent,
    taskKind: args.policy.taskKind,
    model: args.response?.model || args.policy.model,
    toolsOffered: [...args.policy.allowedTools],
    toolsUsed: [...new Set([...(args.localToolsUsed || []), ...webUsed])],
    imageDetail: args.imageIncluded ? args.policy.imageDetail : null,
    imageResent: args.imageResent,
    inputTokens: args.response?.usage?.input_tokens || 0,
    cachedTokens: args.response?.usage?.input_tokens_details.cached_tokens || 0,
    outputTokens: args.response?.usage?.output_tokens || 0,
    latencyMs: Math.round(args.latencyMs),
    success: args.success,
    failureCode: args.failureCode || null,
  };
}
