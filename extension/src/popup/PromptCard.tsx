import { useState } from "react";
import { Globe, Lock, Pencil, Star, Users } from "lucide-react";
import type { Prompt } from "shared";

// same two-line row language as the dashboard list, at popup width:
// title + one-line excerpt, source badge, visibility icon, hover actions
interface Props {
  prompt: Prompt;
  isSelected?: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
}

const SOURCE_DOTS: Record<string, string> = {
  chatgpt: "hsl(160 25% 50%)",
  claude: "hsl(24 30% 55%)",
  gemini: "hsl(217 30% 58%)",
  perplexity: "hsl(190 25% 48%)",
  poe: "hsl(260 22% 56%)",
};

export function PromptCard({
  prompt,
  isSelected = false,
  onCopy,
  onEdit,
  onTogglePin,
}: Props) {
  const [copied, setCopied] = useState(false);
  const source = prompt.tags.find((t) => t in SOURCE_DOTS) ?? null;

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const visTitle =
    prompt.visibility === "public"
      ? "public"
      : prompt.teamId
        ? "shared with team"
        : "private";

  return (
    <div
      className={`row ${isSelected ? "selected" : ""}`}
      onClick={copy}
      title="Click to copy · ↵ inserts"
    >
      <div className="row-main">
        <div className="row-head">
          {prompt.pinned && <span className="pin">★</span>}
          <span className="row-title">{prompt.title}</span>
          {copied && <span className="copied">Copied ✓</span>}
        </div>
        <div className="row-excerpt">{prompt.body.replace(/\s+/g, " ")}</div>
      </div>

      <div className="row-meta">
        <span className="row-passive" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {source && (
            <span className="source-chip">
              <span className="dot" style={{ background: SOURCE_DOTS[source] }} />
              {source}
            </span>
          )}
          <span title={visTitle} style={{ display: "inline-flex" }}>
            {prompt.visibility === "public" ? (
              <Globe size={13} />
            ) : prompt.teamId ? (
              <Users size={13} />
            ) : (
              <Lock size={13} />
            )}
          </span>
          {prompt.useCount > 0 && (
            <span className="use-count" title={`Copied ${prompt.useCount} times`}>
              {prompt.useCount}×
            </span>
          )}
        </span>
        <span className="row-actions">
          <button
            className={`icon-btn ${prompt.pinned ? "starred" : ""}`}
            title={prompt.pinned ? "Unpin" : "Pin"}
            aria-label={prompt.pinned ? "Unpin prompt" : "Pin prompt"}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
          >
            <Star size={14} fill={prompt.pinned ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-btn"
            title="Edit"
            aria-label="Edit prompt"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={14} />
          </button>
        </span>
      </div>
    </div>
  );
}
