"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

interface UsageRow {
  day: string;
  site: string;
  tokens: number;
}

const DAYS_SHOWN = 14;

// stable site → color mapping (ink first, then muted semantics — data viz only)
const SITE_COLORS = ["#292524", "#8a5a06", "#2b5d8a", "#7a3d78", "#9f2d20"];

const formatTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

export default function UsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void api<UsageRow[]>(`/api/v1/usage?days=${DAYS_SHOWN}`)
      .then(setRows)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const { days, sites, maxDay, total } = useMemo(() => {
    const siteSet = [...new Set(rows.map((r) => r.site))].sort();
    const byDay = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const m = byDay.get(r.day) ?? new Map<string, number>();
      m.set(r.site, (m.get(r.site) ?? 0) + r.tokens);
      byDay.set(r.day, m);
    }
    // always render the full window so quiet days show as gaps, not absences
    const list = Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const d = new Date(Date.now() - (DAYS_SHOWN - 1 - i) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return { day: d, perSite: byDay.get(d) ?? new Map<string, number>() };
    });
    const dayTotal = (m: Map<string, number>) =>
      [...m.values()].reduce((a, b) => a + b, 0);
    return {
      days: list,
      sites: siteSet,
      maxDay: Math.max(1, ...list.map((d) => dayTotal(d.perSite))),
      total: rows.reduce((a, r) => a + r.tokens, 0),
    };
  }, [rows]);

  const colorOf = (site: string) =>
    SITE_COLORS[sites.indexOf(site) % SITE_COLORS.length];

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Usage</h1>
        {!isLoading && total > 0 && (
          <span className="text-[13px] tabular-nums text-dim">
            ~{formatTokens(total)} tokens · last {DAYS_SHOWN} days
          </span>
        )}
      </div>
      <p className="mb-5 text-[13px] text-dim">
        Estimated from message length (characters ÷ 4) on chats where the
        extension is active — not billing data.
      </p>

      {isLoading && <div className="skeleton h-48 w-full" />}

      {!isLoading && total === 0 && (
        <div className="panel px-6 py-14 text-center text-[13px] leading-relaxed text-dim">
          Nothing recorded yet. Browse ChatGPT, Claude or Gemini with the
          extension installed — observed messages are estimated locally and
          appear here after the next sync.
        </div>
      )}

      {!isLoading && total > 0 && (
        <div className="panel p-5">
          {/* stacked day bars — pure CSS, no chart lib */}
          <div className="flex h-48 items-end gap-1.5">
            {days.map(({ day, perSite }) => {
              const dayTotal = [...perSite.values()].reduce((a, b) => a + b, 0);
              return (
                <div
                  key={day}
                  className="flex flex-1 flex-col-reverse"
                  title={`${day} — ~${formatTokens(dayTotal)} tokens${[...perSite]
                    .map(([s, t]) => `\n${s}: ~${formatTokens(t)}`)
                    .join("")}`}
                >
                  {[...perSite].map(([site, tokens]) => (
                    <div
                      key={site}
                      style={{
                        height: `${(tokens / maxDay) * 100}%`,
                        background: colorOf(site),
                      }}
                      className="min-h-[2px] first:rounded-b-[3px] last:rounded-t-[3px]"
                    />
                  ))}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-dim">
            <span>{days[0]?.day.slice(5)}</span>
            <span>{days[days.length - 1]?.day.slice(5)}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3">
            {sites.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[12px]">
                <span
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: colorOf(s) }}
                />
                {s}
                <span className="tabular-nums text-dim">
                  ~{formatTokens(rows.filter((r) => r.site === s).reduce((a, r) => a + r.tokens, 0))}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
