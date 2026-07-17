"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
  const reduce = useReducedMotion();

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
      <AnimatePresence initial={false}>
      {items.map((t) => (
        <motion.div
          key={t.id}
          role="status"
          layout
          // enter and exit share one path (down = away), springs so a toast
          // arriving mid-exit retargets smoothly instead of snapping
          initial={{ opacity: 0, y: reduce ? 0 : 14, scale: reduce ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reduce ? 0 : 14, scale: reduce ? 1 : 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          // the ink-glass pill — the app's one dark material
          className="glass-ink pointer-events-auto flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5 text-sm font-medium text-white"
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
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  );
}
