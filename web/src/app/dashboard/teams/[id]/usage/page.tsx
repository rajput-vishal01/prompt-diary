"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/client-api";
import { useApi } from "@/lib/query";
import { toast } from "@/components/Toast";
import { Tip } from "@/components/ui/Tooltip";

// Team usage dashboard — the interactive read on the same estimated numbers
// the team page shows as a stat block. Owner-only, Pro-gated (402) when
// billing is configured. Every figure here is an ESTIMATE (chars ÷ 4).

interface DailyRow {
  userId: string;
  name: string;
  site: string;
  model: string;
  day: string; // YYYY-MM-DD
  tokens: number;
}

interface MemberRow {
  userId: string;
  role: string;
  name: string;
  email: string;
}

interface TeamPrompt {
  id: string;
  title: string;
  useCount: number;
  authorName: string;
}

type Range = 7 | 14 | 30;

// same ink-first data-viz palette as /dashboard/usage — stable site → color
const SITE_COLORS = ["#292524", "#8a5a06", "#2b5d8a", "#7a3d78", "#9f2d20", "#3d6b4f", "#6b4f3d"];

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

const dayLabel = (d: string) => d.slice(5).replace("-", "/");

export default function TeamUsageDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: teamList } = useApi<Array<{ id: string; name: string }>>("/api/v1/teams");
  const teamName = teamList ? teamList.find((t) => t.id === id)?.name ?? "Team" : "";
  const { data: membersData } = useApi<{ members: MemberRow[] }>(`/api/v1/teams/${id}/members`);
  const members = membersData?.members ?? [];
  const { data: prompts = [] } = useApi<TeamPrompt[]>(`/api/v1/teams/${id}/prompts`);
  const {
    data: rows = [],
    isLoading: usageLoading,
    error: usageError,
  } = useApi<DailyRow[]>(`/api/v1/teams/${id}/usage?granularity=day`);
  // same four states the old fetch machine produced, derived from the query:
  // 402 "Pro plan" → gated, "Forbidden" → forbidden, any other error → ok (empty)
  const state: "loading" | "ok" | "gated" | "forbidden" = usageLoading
    ? "loading"
    : usageError?.message.includes("Pro plan")
      ? "gated"
      : usageError?.message.includes("Forbidden")
        ? "forbidden"
        : "ok";
  useEffect(() => {
    if (
      usageError &&
      !usageError.message.includes("Pro plan") &&
      !usageError.message.includes("Forbidden")
    )
      toast("Could not load usage", { kind: "error" });
  }, [usageError]);
  const [range, setRange] = useState<Range>(14);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [hiddenSites, setHiddenSites] = useState<Set<string>>(new Set());

  // ---------- derived, all client-side so the toggles are instant ----------

  const sinceDay = useMemo(() => {
    return new Date(Date.now() - (range - 1) * 86_400_000).toISOString().slice(0, 10);
  }, [range]);

  const inRange = useMemo(() => rows.filter((r) => r.day >= sinceDay), [rows, sinceDay]);

  const sites = useMemo(
    () => [...new Set(inRange.map((r) => r.site))].sort(),
    [inRange],
  );
  const colorOf = (site: string) => SITE_COLORS[sites.indexOf(site) % SITE_COLORS.length];

  // rows after the member + site filters — what the chart and model split show
  const filtered = useMemo(
    () =>
      inRange.filter(
        (r) =>
          (!selectedMember || r.userId === selectedMember) && !hiddenSites.has(r.site),
      ),
    [inRange, selectedMember, hiddenSites],
  );

  const days = useMemo(() => {
    const byDay = new Map<string, Map<string, number>>();
    for (const r of filtered) {
      const m = byDay.get(r.day) ?? new Map<string, number>();
      m.set(r.site, (m.get(r.site) ?? 0) + r.tokens);
      byDay.set(r.day, m);
    }
    // full window — quiet days render as gaps, not absences
    return Array.from({ length: range }, (_, i) => {
      const d = new Date(Date.now() - (range - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day: d, perSite: byDay.get(d) ?? new Map<string, number>() };
    });
  }, [filtered, range]);

  const maxDay = Math.max(
    1,
    ...days.map((d) => [...d.perSite.values()].reduce((a, b) => a + b, 0)),
  );

  const total = filtered.reduce((a, r) => a + r.tokens, 0);
  const activeDays = days.filter((d) => d.perSite.size > 0).length;

  // leaderboard always ignores the member filter (it IS the member filter)
  // but respects the site toggles and range
  const leaderboard = useMemo(() => {
    const byMember = new Map<string, { name: string; tokens: number; topSite: string | null; siteTotals: Map<string, number> }>();
    for (const m of members) {
      byMember.set(m.userId, { name: m.name, tokens: 0, topSite: null, siteTotals: new Map() });
    }
    for (const r of inRange) {
      if (hiddenSites.has(r.site)) continue;
      const e = byMember.get(r.userId) ?? { name: r.name, tokens: 0, topSite: null, siteTotals: new Map<string, number>() };
      e.tokens += r.tokens;
      e.siteTotals.set(r.site, (e.siteTotals.get(r.site) ?? 0) + r.tokens);
      byMember.set(r.userId, e);
    }
    const list = [...byMember.entries()].map(([userId, e]) => ({
      userId,
      name: e.name,
      tokens: e.tokens,
      topSite: [...e.siteTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }));
    return list.sort((a, b) => b.tokens - a.tokens);
  }, [members, inRange, hiddenSites]);

  const teamTotal = leaderboard.reduce((a, m) => a + m.tokens, 0);
  const maxMember = Math.max(1, ...leaderboard.map((m) => m.tokens));
  const activeMembers = leaderboard.filter((m) => m.tokens > 0).length;

  const siteSplit = useMemo(() => {
    const bySite = new Map<string, number>();
    for (const r of filtered) bySite.set(r.site, (bySite.get(r.site) ?? 0) + r.tokens);
    return [...bySite.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // real per-model breakdown from the new model dimension
  const modelSplit = useMemo(() => {
    const byModel = new Map<string, number>();
    for (const r of filtered) {
      const label = r.model || "Unknown model";
      byModel.set(label, (byModel.get(label) ?? 0) + r.tokens);
    }
    return [...byModel.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const maxModel = Math.max(1, ...modelSplit.map(([, t]) => t));
  // the headline stat prefers the top *named* model — "Unknown model" (legacy /
  // undetected spend) is real but unhelpful as a highlight
  const topModel = modelSplit.find(([m]) => m !== "Unknown model") ?? modelSplit[0];

  const topPrompts = useMemo(
    () => [...prompts].sort((a, b) => b.useCount - a.useCount).filter((p) => p.useCount > 0).slice(0, 5),
    [prompts],
  );

  const toggleSite = (s: string) =>
    setHiddenSites((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  // ---------- gated / forbidden states ----------

  if (state === "gated" || state === "forbidden") {
    return (
      <div className="mx-auto max-w-3xl">
        <BackBar id={id} teamName={teamName} router={router} />
        <div className="mt-10 py-16 text-center">
          <p className="font-display text-xl font-light text-ink">
            {state === "gated" ? "Usage analytics is part of the Pro plan" : "Owners only"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-dim">
            {state === "gated"
              ? "Upgrade to see per-member token usage, daily trends, and model breakdowns for this team."
              : "Only the team owner can see member usage."}
          </p>
          {state === "gated" && (
            <button
              className="btn-primary mt-5"
              onClick={() =>
                void api<{ url: string }>("/api/v1/billing/checkout", { method: "POST" })
                  .then(({ url }) => {
                    window.location.href = url;
                  })
                  .catch(() => toast("Could not open checkout", { kind: "error" }))
              }
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedName = leaderboard.find((m) => m.userId === selectedMember)?.name;

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <BackBar id={id} teamName={teamName} router={router} />

      {/* masthead: title + range toggle */}
      <div className="mb-6 mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-light tracking-[-0.015em] text-ink">
            {teamName} <span className="text-dim">— usage</span>
          </h1>
          <p className="mt-1 text-sm text-dim">
            What the team sends to each model{selectedName ? <> · showing <span className="font-medium text-ink">{selectedName}</span></> : ""}.
          </p>
        </div>
        <span className="flex h-9 items-center overflow-hidden rounded-lg border border-line-strong">
          {([7, 14, 30] as const).map((r) => (
            <button
              key={r}
              className={`h-full px-3.5 text-[13px] font-medium transition-colors ${
                range === r ? "bg-tint text-ink" : "text-dim hover:text-ink"
              }`}
              onClick={() => setRange(r)}
            >
              {r}d
            </button>
          ))}
        </span>
      </div>

      {state === "loading" && (
        <div className="space-y-4">
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      )}

      {state === "ok" && (
        <>
          {/* ---------- stat band: four display-serif numbers ---------- */}
          <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <Stat label="Total tokens" value={`~${fmt(total)}`} />
            <Stat label="Daily average" value={`~${fmt(Math.round(total / Math.max(1, activeDays)))}`} sub={`${activeDays} active ${activeDays === 1 ? "day" : "days"}`} />
            <Stat label="Active members" value={`${activeMembers}`} sub={`of ${members.length || leaderboard.length}`} />
            <Stat label="Top model" value={topModel?.[0] ?? "—"} sub={topModel ? `~${fmt(topModel[1])}` : "no sends yet"} />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-6">
              {/* ---------- daily stacked chart ---------- */}
              <section className="panel p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                  Daily tokens by site
                  {selectedName && <span className="normal-case tracking-normal text-dim"> — {selectedName}</span>}
                </p>
                {total === 0 ? (
                  <p className="py-14 text-center text-sm text-dim">
                    Nothing recorded in this window{hiddenSites.size ? " with these model filters" : ""}.
                  </p>
                ) : (
                  <>
                    <div className="flex h-56 items-end gap-1">
                      {days.map(({ day, perSite }) => {
                        const dayTotal = [...perSite.values()].reduce((a, b) => a + b, 0);
                        return (
                          <div
                            key={day}
                            className="group flex h-full flex-1 flex-col justify-end"
                            title={`${day} — ~${fmt(dayTotal)} tokens${[...perSite]
                              .sort((a, b) => b[1] - a[1])
                              .map(([s, t]) => `\n${s}: ~${fmt(t)}`)
                              .join("")}`}
                          >
                            <div className="flex flex-col-reverse overflow-hidden rounded-t-[3px] transition-opacity group-hover:opacity-80" style={{ height: `${(dayTotal / maxDay) * 100}%` }}>
                              {[...perSite].map(([site, tokens]) => (
                                <div
                                  key={site}
                                  style={{ height: `${dayTotal ? (tokens / dayTotal) * 100 : 0}%`, background: colorOf(site) }}
                                  className="min-h-[2px]"
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] font-semibold uppercase tabular-nums tracking-[0.08em] text-dim">
                      <span>{dayLabel(days[0]!.day)}</span>
                      <span>{dayLabel(days[days.length - 1]!.day)}</span>
                    </div>
                  </>
                )}
                {/* clickable legend — toggling a model filters everything */}
                {sites.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    {sites.map((s) => (
                      <Tip key={s} label={hiddenSites.has(s) ? `Show ${s}` : `Hide ${s}`}>
                        <button
                          className={`chip gap-1.5 transition-opacity ${hiddenSites.has(s) ? "opacity-40" : ""}`}
                          onClick={() => toggleSite(s)}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: colorOf(s) }} />
                          {s}
                        </button>
                      </Tip>
                    ))}
                    {(hiddenSites.size > 0 || selectedMember) && (
                      <button
                        className="chip text-dim hover:text-ink"
                        onClick={() => {
                          setHiddenSites(new Set());
                          setSelectedMember(null);
                        }}
                      >
                        reset filters ×
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* ---------- split by site: one proportional bar ---------- */}
              {siteSplit.length > 0 && (
                <section className="panel p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                    By site
                  </p>
                  <div className="flex h-3 w-full overflow-hidden rounded-full">
                    {siteSplit.map(([s, t]) => (
                      <div
                        key={s}
                        title={`${s} — ~${fmt(t)} (${Math.round((t / Math.max(1, total)) * 100)}%)`}
                        style={{ width: `${(t / Math.max(1, total)) * 100}%`, background: colorOf(s) }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {siteSplit.map(([s, t]) => (
                      <div key={s} className="flex items-center gap-2 text-sm">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(s) }} />
                        <span className="text-ink">{s}</span>
                        <span className="ml-auto tabular-nums text-dim">
                          ~{fmt(t)} · {Math.round((t / Math.max(1, total)) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ---------- split by model (the new dimension) ---------- */}
              {modelSplit.length > 0 && (
                <section className="panel p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                    By model
                  </p>
                  <div className="space-y-2.5">
                    {modelSplit.map(([model, t]) => (
                      <div key={model} className="flex items-center gap-3 text-sm">
                        <span className="w-40 shrink-0 truncate text-ink" title={model}>
                          {model}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-tint">
                          <span
                            className="block h-full rounded-full bg-ink"
                            style={{ width: `${(t / maxModel) * 100}%` }}
                          />
                        </span>
                        <span className="w-20 shrink-0 text-right tabular-nums text-dim">
                          ~{fmt(t)} · {Math.round((t / Math.max(1, total)) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              {/* ---------- member leaderboard (click = filter) ---------- */}
              <section>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                  Members · click to filter
                </p>
                <div className="panel divide-y divide-line">
                  {leaderboard.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-dim">No members yet.</p>
                  )}
                  {leaderboard.map((m, i) => {
                    const selected = selectedMember === m.userId;
                    return (
                      <button
                        key={m.userId}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-[120ms] ease-out ${
                          selected ? "bg-soft shadow-[inset_2px_0_0_#0c0a09]" : "hover:bg-soft"
                        }`}
                        onClick={() => setSelectedMember(selected ? null : m.userId)}
                      >
                        <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-dim">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-xs font-semibold text-ink">
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                            <span className="shrink-0 text-sm tabular-nums text-dim">
                              {m.tokens > 0 ? `~${fmt(m.tokens)}` : "—"}
                            </span>
                          </span>
                          {/* share-of-team bar — the read-at-a-glance detail */}
                          <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-tint">
                            <span
                              className="block h-full rounded-full transition-[width] duration-300 ease-out"
                              style={{
                                width: `${(m.tokens / maxMember) * 100}%`,
                                background: m.topSite ? colorOf(m.topSite) : "#292524",
                              }}
                            />
                          </span>
                          <span className="mt-1 block text-[11px] text-dim">
                            {m.tokens > 0 ? (
                              <>
                                {Math.round((m.tokens / Math.max(1, teamTotal)) * 100)}% of team
                                {m.topSite && <> · mostly {m.topSite}</>}
                              </>
                            ) : (
                              "no sends in this window"
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ---------- most reused shared prompts ---------- */}
              {topPrompts.length > 0 && (
                <section>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                    Most reused shared prompts
                  </p>
                  <div className="panel divide-y divide-line">
                    {topPrompts.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-dim">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{p.title}</span>
                          <span className="block text-[11px] text-dim">by {p.authorName}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold uppercase tabular-nums tracking-wide text-dim">
                          {p.useCount}×
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* the honesty footnote — same wording as every usage surface */}
          <p className="mt-4 text-xs text-dim">
            Estimated from message length (characters ÷ 4) on chats where the
            extension is active — not billing data. Prompt reuse counts come from
            copy actions on shared prompts.
          </p>
        </>
      )}
    </div>
  );
}

function BackBar({
  id,
  teamName,
  router,
}: {
  id: string;
  teamName: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        className="flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-body transition-colors hover:bg-hover hover:text-ink"
        onClick={() => router.push(`/dashboard/teams?t=${id}`)}
      >
        <ArrowLeft size={15} className="shrink-0" />
        <span className="max-w-52 truncate">{teamName || "Team"}</span>
      </button>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-raised px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dim">{label}</p>
      <p className="mt-0.5 truncate font-display text-2xl font-light tabular-nums text-ink">
        {value}
      </p>
      {sub && <p className="text-[11px] text-dim">{sub}</p>}
    </div>
  );
}
