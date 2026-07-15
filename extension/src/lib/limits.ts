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

// site → plan → limit
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
};

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
