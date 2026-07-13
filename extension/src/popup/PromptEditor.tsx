import { useState } from "react";
import type { Folder, Prompt, Visibility } from "shared";
import type { NewPrompt } from "../lib/vault";
import type { TeamRow } from "../lib/api";

interface Props {
  prompt: Prompt | null; // null = creating
  folders: Folder[];
  teams: TeamRow[]; // empty when signed out
  onSave: (input: NewPrompt, existing: Prompt | null) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function PromptEditor({
  prompt,
  folders,
  teams,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [tags, setTags] = useState(prompt?.tags.join(", ") ?? "");
  const [folderId, setFolderId] = useState(prompt?.folderId ?? "");
  const [visibility, setVisibility] = useState<Visibility>(
    prompt?.visibility ?? "private",
  );
  const [teamId, setTeamId] = useState(prompt?.teamId ?? "");

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
        teamId: teamId || null, // independent — a prompt can be public AND team-shared
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
            <option value="private">Private (closed)</option>
            <option value="public">Public (open)</option>
          </select>
        </div>
        {teams.length > 0 && (
          <div>
            <div className="field-label">Team</div>
            <select value={teamId ?? ""} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">No team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
