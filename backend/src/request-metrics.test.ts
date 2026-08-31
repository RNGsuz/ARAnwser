import { describe, expect, it } from "vitest";
import { buildRequestMetrics } from "./request-metrics.js";

describe("privacy-safe request metrics", () => {
  it("contains operational values but no user content fields", () => {
    const metrics = buildRequestMetrics({
      policy: { intent: "read", taskKind: "direct", model: "fast", reasoningEffort: "low", maxOutputTokens: 1600, imageDetail: "high", allowedTools: ["ocr"] },
      imageIncluded: true, imageResent: false, localToolsUsed: ["ocr"], latencyMs: 12.6, success: true,
    });
    expect(metrics).toMatchObject({ intent: "read", toolsUsed: ["ocr"], imageDetail: "high", latencyMs: 13, success: true });
    expect(metrics).not.toHaveProperty("question");
    expect(metrics).not.toHaveProperty("answer");
    expect(metrics).not.toHaveProperty("ocrText");
  });
});
