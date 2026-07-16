import { describe, expect, test } from "bun:test";
import {
  bucketLimit,
  isReasoningModel,
  limitState,
  limitsFor,
  pruneWindow,
  resetEta,
  siteForHost,
} from "../src/lib/limits";

const HOUR = 3_600_000;

describe("limitState — the three cases", () => {
  test("ok when comfortably under", () => {
    expect(limitState(10, 80)).toBe("ok");
  });
  test("warn when nearing (≥70%)", () => {
    expect(limitState(56, 80)).toBe("warn");
    expect(limitState(55, 80)).toBe("ok");
  });
  test("over when reached", () => {
    expect(limitState(80, 80)).toBe("over");
    expect(limitState(90, 80)).toBe("over");
  });
  test("unlimited plans never warn", () => {
    expect(limitState(9999, null)).toBe("ok");
  });
});

describe("site coverage", () => {
  test("maps every supported host to a site key", () => {
    expect(siteForHost("chatgpt.com")?.key).toBe("chatgpt");
    expect(siteForHost("chat.deepseek.com")?.key).toBe("deepseek");
    expect(siteForHost("grok.com")?.key).toBe("grok");
    expect(siteForHost("copilot.microsoft.com")?.key).toBe("copilot");
    expect(siteForHost("chat.mistral.ai")?.key).toBe("mistral");
    expect(siteForHost("www.kimi.com")?.key).toBe("kimi");
    expect(siteForHost("unknown.example.com")).toBeNull();
  });

  test("sites without a researched entry get the conservative default", () => {
    expect(limitsFor("qwen", "free").windowHours).toBe(5);
    expect(limitsFor("qwen", "free").maxMessages).toBe(50);
    expect(limitsFor("chatgpt", "plus").maxMessages).toBe(80);
    expect(limitsFor("chatgpt", "pro").maxMessages).toBeNull();
  });
});

describe("reasoning bucket — the accuracy fix", () => {
  test("thinking sends draw from a separate, tighter cap", () => {
    // a free ChatGPT user has 15 standard msgs but only ~5 Thinking messages
    expect(bucketLimit("chatgpt", "free", false).maxMessages).toBe(15);
    expect(bucketLimit("chatgpt", "free", true).maxMessages).toBe(5);
    expect(bucketLimit("chatgpt", "free", true).windowHours).toBe(24);
  });

  test("sites with no reasoning cap fall back to the standard bucket", () => {
    const std = bucketLimit("perplexity", "free", false);
    const rsn = bucketLimit("perplexity", "free", true);
    expect(rsn).toEqual(std);
  });

  test("isReasoningModel flags thinking/o-series/pro model labels", () => {
    expect(isReasoningModel("GPT-5 Thinking")).toBe(true);
    expect(isReasoningModel("o3")).toBe(true);
    expect(isReasoningModel("Claude Sonnet 4.5 (extended thinking)")).toBe(true);
    expect(isReasoningModel("Gemini 2.5 Pro")).toBe(true);
    expect(isReasoningModel("GPT-5")).toBe(false);
    expect(isReasoningModel("Claude Sonnet 4.5")).toBe(false);
    expect(isReasoningModel(null)).toBe(false);
  });
});

describe("rolling window", () => {
  test("pruneWindow drops timestamps outside the window", () => {
    const now = Date.now();
    const stamps = [now - 4 * HOUR, now - 2 * HOUR, now - 1000];
    expect(pruneWindow(stamps, 3, now)).toEqual([now - 2 * HOUR, now - 1000]);
  });

  test("resetEta reports when the oldest message frees a slot", () => {
    const now = Date.now();
    expect(resetEta([now - 2 * HOUR], 3, now)).toBe("~1h 0m");
    expect(resetEta([], 3, now)).toBeNull();
  });
});
