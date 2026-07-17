"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Ghost copy pill for public share pages (server components can't own state).
 * countPromptId: pass the public prompt's id to record the copy for the
 * gallery's "most copied" ranking.
 */
export function CopyButton({
  text,
  label = "Copy",
  countPromptId,
}: {
  text: string;
  label?: string;
  countPromptId?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-hover"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (countPromptId) {
          void fetch("/api/v1/gallery/copied", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptId: countPromptId }),
          }).catch(() => {});
        }
      }}
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}
