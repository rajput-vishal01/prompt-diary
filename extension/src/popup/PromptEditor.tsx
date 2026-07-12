import { useState } from "react";
import type { Folder, Prompt, Visibility } from "shared";
import { VISIBILITIES } from "shared";
import type { NewPrompt } from "../lib/vault";

interface Props {
  prompt: Prompt | null; // null = creating
  folders: Folder[];
  onSave: (input: NewPrompt, existing: Prompt | null) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function PromptEditor({ prompt, folders, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [tags, setTags] = useState(prompt?.tags.join(", ") ?? "");
  const [folderId, setFolderId] = useState(prompt?.folderId ?? "");
  const [visibility, setVisibility] = useState<Visibility>(
    prompt?.visibility ?? "private",
  );

  const canSave = title.trim().length > 0 && body.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    onSave(
      {
        title: title.trim(),
        body: body.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 20),
        folderId: folderId || null,
        visibility,
      },
      prompt,
    );
  };

  return (
    <div className="editor">
      <h2>{prompt ? "Edit prompt" : "New prompt"}</h2>
      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        placeholder="Your prompt…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <input
        placeholder="Tags (comma separated)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />
      <div className="row">
        <div>
          <div className="field-label">Folder</div>
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="field-label">Visibility</div>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            {VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {v === "private" ? "Private (closed)" : v === "public" ? "Public (open)" : "Team"}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="actions">
        {prompt && (
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm("Delete this prompt?")) onDelete(prompt.id);
            }}
          >
            Delete
          </button>
        )}
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={save} disabled={!canSave}>
          Save
        </button>
      </div>
    </div>
  );
}
