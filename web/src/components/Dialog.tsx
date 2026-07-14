"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// promise-based dialogs, ledger-styled — replaces every window.prompt/confirm
// usage: const name = await dialog.prompt({ title: "New folder" });
//        const ok = await dialog.confirm({ title: "Delete?", danger: true });

interface PromptOpts {
  title: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
}

interface ConfirmOpts {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type Pending =
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void }
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void };

let push: ((p: Pending) => void) | null = null;

export const dialog = {
  prompt: (opts: PromptOpts) =>
    new Promise<string | null>((resolve) => {
      if (!push) return resolve(null);
      push({ kind: "prompt", opts, resolve });
    }),
  confirm: (opts: ConfirmOpts) =>
    new Promise<boolean>((resolve) => {
      if (!push) return resolve(false);
      push({ kind: "confirm", opts, resolve });
    }),
};

export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    push = (p) => {
      setPending(p);
      setValue(p.kind === "prompt" ? (p.opts.initial ?? "") : "");
    };
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (pending?.kind === "prompt") {
      setTimeout(() => inputRef.current?.select(), 10);
    }
  }, [pending]);

  const close = useCallback(
    (result: string | null | boolean) => {
      if (!pending) return;
      if (pending.kind === "prompt") pending.resolve(result as string | null);
      else pending.resolve(result as boolean);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(pending.kind === "prompt" ? null : false);
      }
      if (e.key === "Enter" && pending.kind === "confirm") {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending, close]);

  if (!pending) return null;

  const cancel = () => close(pending.kind === "prompt" ? null : false);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-ink/30 pt-[26vh]"
      onMouseDown={cancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line bg-raised p-5 shadow-[0_16px_48px_rgba(19,39,30,0.22)]"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-bold">{pending.opts.title}</h2>

        {pending.kind === "prompt" ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) close(value.trim());
            }}
          >
            {pending.opts.label && (
              <p className="text-[12px] text-dim">{pending.opts.label}</p>
            )}
            <input
              ref={inputRef}
              className="input"
              value={value}
              placeholder={pending.opts.placeholder}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={cancel}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!value.trim()}>
                {pending.opts.submitLabel ?? "Save"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.opts.body && (
              <p className="text-[13px] leading-relaxed text-dim">
                {pending.opts.body}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={cancel}>
                Cancel
              </button>
              <button
                className={pending.opts.danger ? "btn text-danger" : "btn-primary"}
                onClick={() => close(true)}
              >
                {pending.opts.confirmLabel ?? (pending.opts.danger ? "Delete" : "OK")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
