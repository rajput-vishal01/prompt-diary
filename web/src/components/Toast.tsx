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
          className="pointer-events-auto flex items-center gap-3 rounded-lg border border-line bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          <span className={t.kind === "error" ? "text-red-300" : ""}>{t.message}</span>
          {t.action && (
            <button
              className="font-bold text-[#7ed8ae] hover:underline"
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
