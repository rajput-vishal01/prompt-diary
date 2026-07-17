import { ArrowRight } from "lucide-react";

// The product, drawn — Ink Glass panels the landing floats over pastel washes.
// No stock screenshots, no div-faked dashboards: these depict the overlay
// layer (popup, widget, palette), so they wear the overlay material.

export function PopupMock() {
  return (
    <div className="glass w-64 rounded-xl p-3">
      <div className="flex h-8 items-center rounded-lg border border-line-strong bg-white/50 px-2.5 text-xs text-dim">
        rewrite in my voice…
        <span className="kbd ml-auto">↵</span>
      </div>
      {["Editorial rewrite pass", "Bug report normalizer", "Launch email v3"].map((t, i) => (
        <div key={t} className={`mt-1.5 rounded-lg px-2.5 py-2 ${i === 0 ? "bg-white/70 shadow-[inset_2px_0_0_#0c0a09]" : ""}`}>
          <p className="truncate text-xs font-medium text-ink">{t}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-dim">Rewrite the following in a tighter…</p>
        </div>
      ))}
    </div>
  );
}

export function ThreadMock() {
  return (
    <div className="glass w-64 rounded-xl p-3">
      <p className="px-1 text-xs font-medium text-ink">Launch email recipe</p>
      {["Draft the angle", "Tighten the hook", "Final subject lines"].map((t, i) => (
        <div key={t} className="mt-1.5 flex items-center gap-2 rounded-lg bg-white/60 px-2.5 py-2">
          <span className="font-mono text-[10px] tabular-nums text-dim">{String(i + 1).padStart(2, "0")}</span>
          <span className="truncate text-xs text-ink">{t}</span>
        </div>
      ))}
      <div className="mt-1.5 rounded-lg bg-white/45 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-dim">
        final output ↓
      </div>
    </div>
  );
}

export function TransferMock() {
  return (
    <div className="glass flex w-64 flex-col items-center gap-2 rounded-xl p-4">
      <div className="flex w-full items-center justify-between">
        <span className="chip">ChatGPT · 14 messages</span>
        <ArrowRight size={14} className="text-dim" />
        <span className="chip">Claude</span>
      </div>
      <div className="w-full rounded-lg bg-white/60 p-2.5 font-mono text-[10px] leading-relaxed text-dim">
        [Context from a previous conversation]
        <br />User: draft the pricing page…
        <br />Assistant: here&apos;s the structure…
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-success">continues where you left off</span>
    </div>
  );
}

export function WidgetMock() {
  return (
    <div className="glass w-56 rounded-xl p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-display italic">Pd</span>
        <span className="text-dim">ChatGPT · 3h</span>
        <span className="ml-auto tabular-nums text-dim">11/15</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-tint">
        <div className="h-full w-3/4 rounded-full bg-amber" />
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-amber">
        Thinking <span className="ml-auto tabular-nums">3/5 · 24h</span>
      </div>
      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-[#f7ead6]">
        <div className="h-full w-3/5 rounded-full bg-amber" />
      </div>
    </div>
  );
}

export function SavedChipMock() {
  return (
    <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-ink">
      <span className="font-display italic">Pd</span>
      Saved to Prompt Diary
      <span className="text-success">✓</span>
    </div>
  );
}

// small drawn visual for each capability's hover preview — the "img" slot
export function CapVisual({ index }: { index: number }) {
  const wash = ["bg-orb-mint", "bg-orb-lavender", "bg-orb-peach", "bg-orb-sky", "bg-orb-rose", "bg-orb-mint"][index % 6];
  return (
    <div className="relative mb-3 h-24 overflow-hidden rounded-lg border border-line">
      <div aria-hidden className={`absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-70 blur-2xl ${wash}`} />
      <div aria-hidden className={`absolute -bottom-8 -left-6 h-24 w-24 rounded-full opacity-50 blur-2xl bg-orb-sky`} />
      <div className="relative flex h-full items-center justify-center">
        {index === 0 && (
          <div className="flex gap-1.5">
            {["research", "voice", "code"].map((t) => (
              <span key={t} className="glass rounded-full px-2.5 py-1 text-[10px] font-medium text-ink">{t}</span>
            ))}
          </div>
        )}
        {index === 1 && (
          <div className="glass w-40 rounded-lg p-1.5">
            <div className="flex h-6 items-center rounded-md bg-white/60 px-2 text-[9px] text-dim">
              search… <span className="kbd ml-auto scale-75">⌘K</span>
            </div>
            <div className="mt-1 h-4 rounded bg-white/70 shadow-[inset_2px_0_0_#0c0a09]" />
          </div>
        )}
        {index === 2 && (
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="glass h-14 w-20 rounded-lg p-1.5">
                <div className="h-1.5 w-3/4 rounded bg-ink/20" />
                <div className="mt-1 h-1 w-full rounded bg-ink/10" />
                <div className="mt-0.5 h-1 w-2/3 rounded bg-ink/10" />
              </div>
            ))}
          </div>
        )}
        {index === 3 && (
          <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-medium text-ink">
            /p/a1b2c3 <span className="text-success">public ↗</span>
          </div>
        )}
        {index === 4 && (
          <div className="flex items-center">
            {["A", "M", "K"].map((c, i) => (
              <span key={c} className={`flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/80 text-[10px] font-semibold text-ink ${i > 0 ? "-ml-2" : ""}`}>
                {c}
              </span>
            ))}
            <span className="glass ml-2 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase text-dim">team</span>
          </div>
        )}
        {index === 5 && (
          <div className="flex items-center gap-2 text-dim">
            <span className="glass rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-ink">laptop</span>
            <span className="text-xs">⇄</span>
            <span className="glass rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-ink">extension</span>
          </div>
        )}
      </div>
    </div>
  );
}
