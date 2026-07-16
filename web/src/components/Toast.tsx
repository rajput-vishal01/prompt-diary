"use client";

import { useEffect, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  kind: "success" | "error";
  action?: { label: string; onClick: () => void };
}

let pushToast: ((t: Omit<ToastItem, "id">) => void) | null = null;
let nextId = 1;

export function toast(
  message: string,
  opts: { kind?: "success" | "error"; action?: ToastItem["action"] } = {},
) {
  pushToast?.({ message, kind: opts.kind ?? "success", action: opts.action });
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (t) => {
      const item = { ...t, id: nextId++ };
      setItems((prev) => [...prev.slice(-2), item]);
      setTimeout(
        () => setItems((prev) => prev.filter((x) => x.id !== item.id)),
        t.action ? 6000 : 3000,
      );
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          // the ink pill — the app's one dark surface
          className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(12,10,9,0.25)]"
        >
          <span aria-hidden className={t.kind === "error" ? "text-red-300" : "text-[#6fcf97]"}>
            {t.kind === "error" ? "✕" : "✓"}
          </span>
          <span>{t.message}</span>
          {t.action && (
            <button
              // kbd-badge-styled action — reads as "press me", not a link
              className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition-colors hover:bg-white/25"
              onClick={() => {
                t.action?.onClick();
                setItems((prev) => prev.filter((x) => x.id !== t.id));
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
