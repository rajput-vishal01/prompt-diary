"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

interface UsageRow {
  day: string;
  site: string;
  model: string;
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

  // per-model breakdown over the window — the new model dimension. "" rows
  // (pre-tracking / undetected) roll up under "Unknown model".
  const byModel = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const label = r.model || "Unknown model";
      m.set(label, (m.get(label) ?? 0) + r.tokens);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const maxModel = Math.max(1, ...byModel.map(([, t]) => t));

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-light tracking-[-0.015em] text-ink">
          Usage
        </h1>
        {!isLoading && total > 0 && (
          <span className="font-display text-2xl font-light tabular-nums text-ink">
            ~{formatTokens(total)}
            <span className="ml-2 font-sans text-sm text-dim">
              tokens · last {DAYS_SHOWN} days
            </span>
          </span>
        )}
      </div>
      <p className="mb-6 text-sm text-dim">
        What you&apos;re sending to each model, day by day.
      </p>

      {isLoading && <div className="skeleton h-48 w-full" />}

      {!isLoading && total === 0 && (
        <div className="py-20 text-center">
          <p className="font-display text-xl font-light text-ink">Nothing recorded yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-dim">
            Browse ChatGPT, Claude or any AI chat with the extension installed —
            observed messages are estimated locally and appear here after the
            next sync.
          </p>
        </div>
      )}

      {!isLoading && total > 0 && (
        <div className="panel p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
            Daily tokens by site
          </p>
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
          <div className="mt-1.5 flex justify-between text-[11px] font-semibold uppercase tabular-nums tracking-[0.08em] text-dim">
            <span>{days[0]?.day.slice(5)}</span>
            <span>{days[days.length - 1]?.day.slice(5)}</span>
          </div>
          {/* per-site legend as chips */}
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {sites.map((s) => (
              <span key={s} className="chip gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
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

      {/* per-model breakdown — which models the tokens actually went to */}
      {!isLoading && total > 0 && byModel.length > 0 && (
        <div className="panel mt-4 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
            By model
          </p>
          <div className="space-y-2.5">
            {byModel.map(([model, tok]) => (
              <div key={model} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-ink" title={model}>
                  {model}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
                  <span
                    className="block h-full rounded-full bg-ink"
                    style={{ width: `${(tok / maxModel) * 100}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums text-dim">
                  ~{formatTokens(tok)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* the honesty footnote — everything on this page is a ballpark */}
      <p className="mt-3 text-xs text-dim">
        Estimated from message length (characters ÷ 4) on chats where the
        extension is active — not billing data. Model is auto-detected from the
        page and may be blank when it can&apos;t be read.
      </p>
    </div>
  );
}
