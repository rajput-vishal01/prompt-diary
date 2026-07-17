import { useState } from "react";
import type { Folder, Prompt, Visibility } from "shared";
import type { NewPrompt } from "../lib/vault";
import type { TeamRow } from "../lib/api";
import { GlassSelect } from "./GlassSelect";

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
          <GlassSelect
            ariaLabel="Folder"
            value={folderId}
            onChange={setFolderId}
            options={[
              { value: "", label: "No folder" },
              ...folders.map((f) => ({ value: f.id, label: f.name })),
            ]}
          />
        </div>
        <div>
          <div className="field-label">Visibility</div>
          <GlassSelect
            ariaLabel="Visibility"
            value={visibility}
            onChange={(v) => setVisibility(v as Visibility)}
            options={[
              { value: "private", label: "Private (closed)" },
              { value: "public", label: "Public (open)" },
            ]}
          />
        </div>
        {teams.length > 0 && (
          <div>
            <div className="field-label">Team</div>
            <GlassSelect
              ariaLabel="Team"
              value={teamId ?? ""}
              onChange={setTeamId}
              options={[
                { value: "", label: "No team" },
                ...teams.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>
        )}
      </div>
      <div className="actions">
        {prompt && (
          <button
            className="btn danger"
            onClick={() => {
              onDelete(prompt.id); // App wraps this in a styled confirm
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
