import { useState } from "react";
import type { Folder, Prompt } from "shared";

interface Props {
  prompt: Prompt;
  folders: Folder[];
  onCopy: () => void;
  onEdit: () => void;
  onTogglePin: () => void;
}

export function PromptCard({ prompt, folders, onCopy, onEdit, onTogglePin }: Props) {
  const [copied, setCopied] = useState(false);
  const folder = folders.find((f) => f.id === prompt.folderId);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="card" onClick={copy} title="Click to copy">
      <div className="card-head">
        {prompt.pinned && <span className="pin">★</span>}
        <span className="card-title">{prompt.title}</span>
        {copied && <span className="copied">Copied!</span>}
      </div>
      <div className="card-body">{prompt.body}</div>
      <div className="card-foot">
        {folder && (
          <span className="tag" style={{ background: "transparent", border: `1px solid ${folder.color}`, color: folder.color }}>
            {folder.name}
          </span>
        )}
        {prompt.tags.slice(0, 3).map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
        <span className={`vis ${prompt.visibility}`}>{prompt.visibility}</span>
        <span className="spacer" />
        <button
          className="btn small"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          {prompt.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          className="btn small"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
