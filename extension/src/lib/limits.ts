// Per-site model limits, ESTIMATED. AI vendors rate-limit by messages over a
// rolling window and never publish exact numbers — these are widely-reported
// ballparks, editable in one place. The widget always says "estimated".
// Standalone module (no imports) so the content-script bundle stays lean.

export type Plan = "free" | "plus" | "pro";

export interface SiteLimit {
  windowHours: number;
  maxMessages: number | null; // null = effectively unlimited on this plan
  // Reasoning/thinking sends burn far more compute and every provider caps
  // them SEPARATELY (ChatGPT Thinking + Claude extended-thinking each carry
  // their own, much smaller quota). Tracking them in the same bucket as instant
  // messages is why a flat "15 msgs" count is meaningless. Omit = no separate
  // reasoning cap on this site (reasoning falls back to the standard bucket).
  reasoning?: { windowHours: number; maxMessages: number | null };
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
  free: { windowHours: 5, maxMessages: 50, reasoning: { windowHours: 24, maxMessages: 10 } },
  plus: { windowHours: 5, maxMessages: 250, reasoning: { windowHours: 24, maxMessages: 50 } },
  pro: { windowHours: 5, maxMessages: null, reasoning: { windowHours: 24, maxMessages: null } },
};

// site → plan → limit (ballparks; tune freely). Reasoning caps are the small
// separate quotas for thinking-mode sends — deliberately tight because a single
// high-reasoning message can eat a large slice of the day's reasoning budget.
export const LIMITS: Record<string, Record<Plan, SiteLimit>> = {
  chatgpt: {
    free: { windowHours: 3, maxMessages: 15, reasoning: { windowHours: 24, maxMessages: 5 } },
    plus: { windowHours: 3, maxMessages: 80, reasoning: { windowHours: 168, maxMessages: 200 } },
    pro: { windowHours: 3, maxMessages: null, reasoning: { windowHours: 24, maxMessages: null } },
  },
  claude: {
    free: { windowHours: 5, maxMessages: 40, reasoning: { windowHours: 24, maxMessages: 10 } },
    plus: { windowHours: 5, maxMessages: 200, reasoning: { windowHours: 168, maxMessages: 100 } },
    pro: { windowHours: 5, maxMessages: null, reasoning: { windowHours: 168, maxMessages: null } },
  },
  gemini: {
    free: { windowHours: 24, maxMessages: 100, reasoning: { windowHours: 24, maxMessages: 20 } },
    plus: { windowHours: 24, maxMessages: 500, reasoning: { windowHours: 24, maxMessages: 100 } },
    pro: { windowHours: 24, maxMessages: null, reasoning: { windowHours: 24, maxMessages: null } },
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
    free: { windowHours: 2, maxMessages: 20, reasoning: { windowHours: 24, maxMessages: 10 } },
    plus: { windowHours: 2, maxMessages: 100, reasoning: { windowHours: 24, maxMessages: 50 } },
    pro: { windowHours: 2, maxMessages: null, reasoning: { windowHours: 24, maxMessages: null } },
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

/**
 * The bucket a send draws from. Reasoning sends have their own (tighter) cap
 * when the site defines one; otherwise they fall back to the standard bucket.
 */
export function bucketLimit(
  site: string,
  plan: Plan,
  reasoning: boolean,
): { windowHours: number; maxMessages: number | null } {
  const l = limitsFor(site, plan);
  return reasoning && l.reasoning
    ? l.reasoning
    : { windowHours: l.windowHours, maxMessages: l.maxMessages };
}

/** True if a detected model label is itself a reasoning/thinking model. */
export function isReasoningModel(label: string | null | undefined): boolean {
  if (!label) return false;
  return /think|reason|\bo[134]\b|\bpro\b|deep\s?research/i.test(label);
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

/** "~2h 15m" / "~40m" for a duration in ms; null when already elapsed. */
export function fmtDuration(ms: number): string | null {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
}

/** When the oldest in-window message falls out — i.e. when a slot frees up. */
export function resetEta(timestamps: number[], windowHours: number, now: number): string | null {
  const oldest = timestamps[0];
  if (oldest === undefined) return null;
  return fmtDuration(oldest + windowHours * 3_600_000 - now);
}

// ---------- site-reported limit detection ----------
// Counting sends can only ever be a guess (real quotas are compute-weighted
// and per-account). When the site ITSELF says the limit is reached — the
// banner every chat app shows — that is ground truth: believe it, mark the
// bucket exhausted, and calibrate the cap to what was actually observed.

// strong phrasings only — a chat message casually mentioning "limit" must not
// trip this, so every alternative anchors on an explicit hit-the-wall sentence
const LIMIT_BANNER_RE =
  /(you(?:'|’)?(?:ve| have) (?:reached|hit) (?:your|the)[^.\n]{0,60}\blimit|you(?:'|’)?re out of (?:messages|free messages|usage)|out of (?:messages|usage) until|(?:message|usage|rate) limit reached|reached your (?:daily|weekly|monthly|usage)[^.\n]{0,30}\blimit|limit[^.\n]{0,20}\bresets? (?:at|in)\b|no (?:messages|uses|responses) (?:left|remaining) until)/i;

/** Non-null when `text` reads as a limit banner; says which bucket it names. */
export function matchLimitBanner(text: string): { reasoning: boolean } | null {
  if (!LIMIT_BANNER_RE.test(text)) return null;
  return { reasoning: /think|reason|extended/i.test(text) };
}

/**
 * Epoch ms parsed from a banner's own reset phrasing ("until 4 PM",
 * "resets in 2 hours", "try again tomorrow"); null when it names none.
 */
export function parseResetTime(text: string, now: number): number | null {
  const clock = text.match(/\b(?:until|at|after)\s+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i);
  if (clock) {
    let h = parseInt(clock[1]!, 10) % 12;
    if (clock[3]!.toLowerCase() === "p") h += 12;
    const d = new Date(now);
    d.setHours(h, clock[2] ? parseInt(clock[2], 10) : 0, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1); // that time already passed today
    return d.getTime();
  }
  const rel = text.match(/\bin\s+(\d+)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
  if (rel) {
    return now + parseInt(rel[1]!, 10) * (/^h/i.test(rel[2]!) ? 3_600_000 : 60_000);
  }
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date(now);
    d.setHours(24, 0, 0, 0); // next local midnight
    return d.getTime();
  }
  return null;
}

// ---------- official usage (claude.ai exposes its own numbers) ----------
// claude.ai's app fetches /api/organizations/<org>/usage — the same data its
// native usage page renders. The response shape isn't a public contract, so
// walk it defensively for {utilization, resets_at} pairs instead of trusting
// exact field paths; on any drift this returns null and estimates take over.

export interface OfficialUsage {
  pct: number; // 0..1
  resetsAt: number | null; // epoch ms
}

export function extractOfficialUsage(json: unknown, now: number): OfficialUsage | null {
  let best: OfficialUsage | null = null;
  const visit = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o["utilization"] === "number") {
      const raw = o["utilization"];
      const pct = raw > 1 ? raw / 100 : raw; // seen as both 0–1 and 0–100
      const rs = typeof o["resets_at"] === "string" ? Date.parse(o["resets_at"]) : NaN;
      const resetsAt = Number.isFinite(rs) && rs > now ? rs : null;
      if (!best || pct > best.pct) best = { pct, resetsAt };
    }
    for (const k of Object.keys(o)) visit(o[k]);
  };
  visit(json);
  return best;
}
