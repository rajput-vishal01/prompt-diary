import { describe, expect, test } from "bun:test";
import {
  bucketLimit,
  extractOfficialUsage,
  fmtDuration,
  isReasoningModel,
  limitState,
  limitsFor,
  matchLimitBanner,
  parseResetTime,
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

// ---------- site-reported limits: ground truth over guesses ----------

describe("matchLimitBanner", () => {
  test("matches real banner phrasings from the big three", () => {
    expect(matchLimitBanner("You've hit the Plus plan limit for GPT-4o.")).not.toBeNull();
    expect(matchLimitBanner("You're out of messages until 4 AM")).not.toBeNull();
    expect(matchLimitBanner("You've reached your daily limit.")).not.toBeNull();
    expect(matchLimitBanner("Usage limit reached. Try again later.")).not.toBeNull();
    expect(matchLimitBanner("You have hit the free plan limit.")).not.toBeNull();
  });

  test("attributes thinking/reasoning banners to the reasoning bucket", () => {
    expect(matchLimitBanner("You've hit the extended thinking limit")).toEqual({ reasoning: true });
    expect(matchLimitBanner("You've hit the Plus plan limit")).toEqual({ reasoning: false });
  });

  test("ignores casual limit talk that isn't a banner", () => {
    expect(matchLimitBanner("the speed limit reached 120 on that road")).toBeNull();
    expect(matchLimitBanner("we should limit the scope of this function")).toBeNull();
    expect(matchLimitBanner("what are the rate limits for this API?")).toBeNull();
  });
});

describe("parseResetTime", () => {
  const noon = new Date("2026-07-16T12:00:00").getTime(); // local noon

  test("clock time later today", () => {
    const t = parseResetTime("You're out of messages until 4 PM", noon)!;
    expect(new Date(t).getHours()).toBe(16);
    expect(t).toBeGreaterThan(noon);
    expect(t - noon).toBeLessThanOrEqual(24 * HOUR);
  });

  test("clock time already passed rolls to tomorrow", () => {
    const t = parseResetTime("out of messages until 4 AM", noon)!;
    expect(new Date(t).getHours()).toBe(4);
    expect(t).toBeGreaterThan(noon);
  });

  test("relative hours and minutes", () => {
    expect(parseResetTime("limit resets in 2 hours", noon)).toBe(noon + 2 * HOUR);
    expect(parseResetTime("try again in 45 minutes", noon)).toBe(noon + 45 * 60_000);
  });

  test("tomorrow means next local midnight", () => {
    const t = parseResetTime("You've reached your daily limit. Try again tomorrow.", noon)!;
    expect(new Date(t).getHours()).toBe(0);
    expect(t - noon).toBe(12 * HOUR);
  });

  test("null when the banner names no reset", () => {
    expect(parseResetTime("Usage limit reached.", noon)).toBeNull();
  });
});

describe("extractOfficialUsage — claude.ai's own numbers", () => {
  const now = Date.now();

  test("finds the worst utilization in a nested response", () => {
    const resets = new Date(now + HOUR).toISOString();
    const u = extractOfficialUsage(
      {
        five_hour: { utilization: 0.34, resets_at: resets },
        seven_day: { utilization: 0.82, resets_at: resets },
      },
      now,
    )!;
    expect(u.pct).toBeCloseTo(0.82);
    expect(u.resetsAt).toBe(Date.parse(resets));
  });

  test("normalizes a 0-100 scale and ignores past reset timestamps", () => {
    const u = extractOfficialUsage(
      { usage: { utilization: 82, resets_at: new Date(now - 1000).toISOString() } },
      now,
    )!;
    expect(u.pct).toBeCloseTo(0.82);
    expect(u.resetsAt).toBeNull();
  });

  test("null on unrecognized shapes", () => {
    expect(extractOfficialUsage({ foo: "bar" }, now)).toBeNull();
    expect(extractOfficialUsage(null, now)).toBeNull();
    expect(extractOfficialUsage("nope", now)).toBeNull();
  });
});

describe("fmtDuration", () => {
  test("hours+minutes, minutes only, elapsed", () => {
    expect(fmtDuration(2 * HOUR + 15 * 60_000)).toBe("~2h 15m");
    expect(fmtDuration(40 * 60_000)).toBe("~40m");
    expect(fmtDuration(0)).toBeNull();
  });
});
