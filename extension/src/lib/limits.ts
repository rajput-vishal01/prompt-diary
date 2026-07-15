// Per-site model limits, ESTIMATED. AI vendors rate-limit by messages over a
// rolling window and never publish exact numbers — these are widely-reported
// ballparks, editable in one place. The widget always says "estimated".
// Standalone module (no imports) so the content-script bundle stays lean.

export type Plan = "free" | "plus" | "pro";

export interface SiteLimit {
  windowHours: number;
  maxMessages: number | null; // null = effectively unlimited on this plan
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  plus: "Plus / Pro",
  pro: "Max / Ultra",
};

// every model site we track — hostname pattern → site key + display name.
// Tracking is send-event based (no DOM message selectors), so adding a site
// here is ALL it takes (plus a manifest match) for the tracker to work on it.
export const SITES: Array<{ key: string; name: string; host: RegExp }> = [
  { key: "chatgpt", name: "ChatGPT", host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/ },
  { key: "claude", name: "Claude", host: /(^|\.)claude\.ai$/ },
  { key: "gemini", name: "Gemini", host: /(^|\.)gemini\.google\.com$/ },
  { key: "perplexity", name: "Perplexity", host: /(^|\.)perplexity\.ai$/ },
  { key: "poe", name: "Poe", host: /(^|\.)poe\.com$/ },
  { key: "deepseek", name: "DeepSeek", host: /(^|\.)chat\.deepseek\.com$/ },
  { key: "grok", name: "Grok", host: /(^|\.)grok\.com$/ },
  { key: "copilot", name: "Copilot", host: /(^|\.)copilot\.microsoft\.com$/ },
  { key: "mistral", name: "Le Chat", host: /(^|\.)chat\.mistral\.ai$/ },
  { key: "kimi", name: "Kimi", host: /(^|\.)kimi\.com$|(^|\.)kimi\.moonshot\.cn$/ },
  { key: "qwen", name: "Qwen", host: /(^|\.)chat\.qwen\.ai$/ },
  { key: "meta", name: "Meta AI", host: /(^|\.)meta\.ai$/ },
];

export function siteForHost(hostname: string): { key: string; name: string } | null {
  const s = SITES.find((s) => s.host.test(hostname));
  return s ? { key: s.key, name: s.name } : null;
}

export function siteDisplayName(key: string): string {
  return SITES.find((s) => s.key === key)?.name ?? key;
}

// sites without a researched entry fall back to this conservative default
export const DEFAULT_LIMITS: Record<Plan, SiteLimit> = {
  free: { windowHours: 5, maxMessages: 50 },
  plus: { windowHours: 5, maxMessages: 250 },
  pro: { windowHours: 5, maxMessages: null },
};

// site → plan → limit (ballparks; tune freely)
export const LIMITS: Record<string, Record<Plan, SiteLimit>> = {
  chatgpt: {
    free: { windowHours: 3, maxMessages: 15 },
    plus: { windowHours: 3, maxMessages: 80 },
    pro: { windowHours: 3, maxMessages: null },
  },
  claude: {
    free: { windowHours: 5, maxMessages: 40 },
    plus: { windowHours: 5, maxMessages: 200 },
    pro: { windowHours: 5, maxMessages: null },
  },
  gemini: {
    free: { windowHours: 24, maxMessages: 100 },
    plus: { windowHours: 24, maxMessages: 500 },
    pro: { windowHours: 24, maxMessages: null },
  },
  perplexity: {
    free: { windowHours: 24, maxMessages: 100 },
    plus: { windowHours: 24, maxMessages: 600 },
    pro: { windowHours: 24, maxMessages: null },
  },
  deepseek: {
    free: { windowHours: 24, maxMessages: 200 },
    plus: { windowHours: 24, maxMessages: null },
    pro: { windowHours: 24, maxMessages: null },
  },
  grok: {
    free: { windowHours: 2, maxMessages: 20 },
    plus: { windowHours: 2, maxMessages: 100 },
    pro: { windowHours: 2, maxMessages: null },
  },
  copilot: {
    free: { windowHours: 24, maxMessages: 300 },
    plus: { windowHours: 24, maxMessages: null },
    pro: { windowHours: 24, maxMessages: null },
  },
};

export function limitsFor(site: string, plan: Plan): SiteLimit {
  return LIMITS[site]?.[plan] ?? DEFAULT_LIMITS[plan];
}

export type LimitState = "ok" | "warn" | "over";

// the three cases: comfortably under → nearing (≥70%) → likely reached
export function limitState(count: number, max: number | null): LimitState {
  if (max === null) return "ok";
  if (count >= max) return "over";
  if (count >= max * 0.7) return "warn";
  return "ok";
}

/** Timestamps inside the rolling window, oldest pruned. */
export function pruneWindow(timestamps: number[], windowHours: number, now: number): number[] {
  const cutoff = now - windowHours * 3_600_000;
  return timestamps.filter((t) => t > cutoff);
}

/** When the oldest in-window message falls out — i.e. when a slot frees up. */
export function resetEta(timestamps: number[], windowHours: number, now: number): string | null {
  const oldest = timestamps[0];
  if (oldest === undefined) return null;
  const ms = oldest + windowHours * 3_600_000 - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
}
