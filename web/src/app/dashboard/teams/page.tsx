"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { useSession } from "@/lib/auth-client";

interface TeamRow {
  id: string;
  name: string;
  ownerId: string;
  role: "owner" | "member";
}

interface MembersData {
  members: { userId: string; role: string; name: string; email: string }[];
  invites: { id: string; email: string }[];
}

interface TeamPrompt {
  id: string;
  title: string;
  body: string;
  tags: string[];
  useCount: number;
  authorName: string;
}

export default function TeamsPage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selected, setSelected] = useState<TeamRow | null>(null);
  const [members, setMembers] = useState<MembersData | null>(null);
  const [prompts, setPrompts] = useState<TeamPrompt[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reloadTeams = () => {
    void api<TeamRow[]>("/api/v1/teams").then((rows) => {
      setTeams(rows);
      setSelected((cur) => rows.find((r) => r.id === cur?.id) ?? rows[0] ?? null);
    });
  };

  useEffect(reloadTeams, []);

  useEffect(() => {
    if (!selected) {
      setMembers(null);
      setPrompts([]);
      return;
    }
    void api<MembersData>(`/api/v1/teams/${selected.id}/members`).then(setMembers);
    void api<TeamPrompt[]>(`/api/v1/teams/${selected.id}/prompts`).then(setPrompts);
  }, [selected]);

  const createTeam = async () => {
    const name = window.prompt("Team name");
    if (name?.trim()) {
      await api("/api/v1/teams", { method: "POST", body: { name: name.trim() } });
      reloadTeams();
    }
  };

  const invite = async () => {
    if (!selected || !inviteEmail.trim()) return;
    setMessage(null);
    try {
      const res = await api<{ status: string }>(
        `/api/v1/teams/${selected.id}/members`,
        { method: "POST", body: { email: inviteEmail.trim() } },
      );
      setMessage(
        res.status === "added"
          ? "User added to the team."
          : "Invite created — they'll join on their next sign-in.",
      );
      setInviteEmail("");
      void api<MembersData>(`/api/v1/teams/${selected.id}/members`).then(setMembers);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invite failed");
    }
  };

  const removeMember = async (userId: string) => {
    if (!selected) return;
    await api(`/api/v1/teams/${selected.id}/members`, {
      method: "DELETE",
      body: { userId },
    });
    void api<MembersData>(`/api/v1/teams/${selected.id}/members`).then(setMembers);
  };

  const deleteTeam = async () => {
    if (!selected || !window.confirm(`Delete team "${selected.name}"? Team prompts become private.`))
      return;
    await api(`/api/v1/teams/${selected.id}`, { method: "DELETE" });
    reloadTeams();
  };

  const copy = (p: TeamPrompt) => {
    void navigator.clipboard.writeText(p.body);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const isOwner = selected?.role === "owner";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <button className="btn-primary" onClick={() => void createTeam()}>
          + New team
        </button>
      </div>

      {teams.length === 0 ? (
        <p className="py-16 text-center text-dim">
          No teams yet. Create one and invite teammates to share prompts.
        </p>
      ) : (
        <>
          <div className="mb-6 flex gap-2">
            {teams.map((t) => (
              <button
                key={t.id}
                className={`btn ${selected?.id === t.id ? "border-accent text-white" : "text-dim"}`}
                onClick={() => setSelected(t)}
              >
                {t.name}
                {t.role === "owner" && " 👑"}
              </button>
            ))}
          </div>

          {selected && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="card space-y-3">
                <h2 className="font-semibold">Members</h2>
                {members?.members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">
                      {m.name} <span className="text-dim">· {m.email}</span>
                    </span>
                    <span className="text-xs capitalize text-dim">{m.role}</span>
                    {isOwner && m.userId !== session?.user.id && (
                      <button
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => void removeMember(m.userId)}
                      >
                        remove
                      </button>
                    )}
                    {!isOwner && m.userId === session?.user.id && (
                      <button
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => void removeMember(m.userId)}
                      >
                        leave
                      </button>
                    )}
                  </div>
                ))}
                {members && members.invites.length > 0 && (
                  <div className="border-t border-line pt-2 text-sm text-dim">
                    Pending: {members.invites.map((i) => i.email).join(", ")}
                  </div>
                )}
                {isOwner && (
                  <div className="flex gap-2 pt-2">
                    <input
                      className="input"
                      placeholder="teammate@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void invite()}
                    />
                    <button className="btn-primary" onClick={() => void invite()}>
                      Invite
                    </button>
                  </div>
                )}
                {message && <p className="text-xs text-emerald-400">{message}</p>}
                {isOwner && (
                  <button
                    className="pt-2 text-xs text-red-400 hover:underline"
                    onClick={() => void deleteTeam()}
                  >
                    Delete team
                  </button>
                )}
              </div>

              <div className="card space-y-3">
                <h2 className="font-semibold">Team prompt library</h2>
                {prompts.length === 0 && (
                  <p className="text-sm text-dim">
                    Nothing shared yet. Set a prompt's visibility to “Team” to
                    share it here.
                  </p>
                )}
                {prompts.map((p) => (
                  <div key={p.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-semibold">
                        {p.title}
                      </span>
                      {copiedId === p.id && (
                        <span className="text-xs text-emerald-400">Copied!</span>
                      )}
                      <button className="btn" onClick={() => copy(p)}>
                        Copy
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-dim">{p.body}</p>
                    <p className="mt-2 text-xs text-dim">
                      by {p.authorName} · used {p.useCount}×
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
