"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { useSession } from "@/lib/auth-client";
import { dialog } from "@/components/Dialog";

interface TeamRow {
  id: string;
  name: string;
  ownerId: string;
  role: "owner" | "member";
  createdAt: string;
}

interface InviteRow {
  id: string;
  teamId: string;
  teamName: string;
  invitedByName: string;
}

interface TeamUsageRow {
  userId: string;
  name: string;
  site: string;
  tokens: number;
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
  visibility: "private" | "public";
  useCount: number;
  authorName: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [selected, setSelected] = useState<TeamRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    void api<TeamRow[]>("/api/v1/teams").then((rows) => {
      setTeams(rows);
      setSelected((cur) => rows.find((r) => r.id === cur?.id) ?? null);
    });
    void api<InviteRow[]>("/api/v1/invites").then(setInvites);
  };

  useEffect(reload, []);

  const createTeam = async () => {
    const name = await dialog.prompt({ title: "New team", placeholder: "Team name", submitLabel: "Create" });
    if (!name?.trim()) return;
    setError(null);
    try {
      await api("/api/v1/teams", { method: "POST", body: { name: name.trim() } });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create team");
    }
  };

  const answerInvite = async (id: string, action: "accept" | "decline") => {
    setError(null);
    try {
      await api(`/api/v1/invites/${id}`, { method: "POST", body: { action } });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update invite");
    }
  };

  if (selected) {
    return (
      <TeamDetail
        team={selected}
        onBack={() => setSelected(null)}
        onChanged={reload}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <button className="btn-primary" onClick={() => void createTeam()}>
          + New team
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {invites.length > 0 && (
        <div className="mb-6 divide-y divide-line overflow-hidden rounded-[10px] border border-accent/40 bg-tint">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <p className="flex-1 text-sm">
                <span className="font-semibold">{inv.invitedByName}</span>{" "}
                invited you to <span className="font-semibold">{inv.teamName}</span>
              </p>
              <button
                className="btn-primary px-3 py-1 text-xs"
                onClick={() => void answerInvite(inv.id, "accept")}
              >
                Accept
              </button>
              <button
                className="btn px-3 py-1 text-xs"
                onClick={() => void answerInvite(inv.id, "decline")}
              >
                Decline
              </button>
            </div>
          ))}
        </div>
      )}

      {teams.length === 0 ? (
        <p className="py-16 text-center text-sm text-dim">
          No teams yet. Create one and invite teammates — they accept the
          invite from this page, then you share prompts by setting their
          visibility to “Team”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((t) => (
            <button
              key={t.id}
              className="card group cursor-pointer text-left transition-colors hover:border-accent"
              onClick={() => setSelected(t)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tint font-display text-lg italic text-accent">
                  {t.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="block text-xs capitalize text-dim">
                    {t.role}
                  </span>
                </span>
                <span className="text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-accent">
                  →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamDetail({
  team,
  onBack,
  onChanged,
}: {
  team: TeamRow;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  const [members, setMembers] = useState<MembersData | null>(null);
  const [prompts, setPrompts] = useState<TeamPrompt[]>([]);
  const [usage, setUsage] = useState<TeamUsageRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isOwner = team.role === "owner";

  const reloadDetail = () => {
    void api<MembersData>(`/api/v1/teams/${team.id}/members`).then(setMembers);
    void api<TeamPrompt[]>(`/api/v1/teams/${team.id}/prompts`).then(setPrompts);
    if (team.role === "owner")
      void api<TeamUsageRow[]>(`/api/v1/teams/${team.id}/usage`)
        .then(setUsage)
        .catch(() => {});
  };

  useEffect(reloadDetail, [team.id]);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setMessage(null);
    try {
      await api(`/api/v1/teams/${team.id}/members`, {
        method: "POST",
        body: { email: inviteEmail.trim() },
      });
      setMessage("Invite sent — they'll see it on their Teams page.");
      setInviteEmail("");
      reloadDetail();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invite failed");
    }
  };

  const removeMember = async (userId: string) => {
    await api(`/api/v1/teams/${team.id}/members`, {
      method: "DELETE",
      body: { userId },
    });
    if (userId === session?.user.id) {
      onChanged();
      onBack();
      return;
    }
    reloadDetail();
  };

  const deleteTeam = async () => {
    if (!(await dialog.confirm({ title: `Delete team “${team.name}”?`, body: "Team prompts become private.", danger: true })))
      return;
    await api(`/api/v1/teams/${team.id}`, { method: "DELETE" });
    onChanged();
    onBack();
  };

  const copy = (p: TeamPrompt) => {
    void navigator.clipboard.writeText(p.body);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <button className="btn" onClick={onBack}>
          ← All teams
        </button>
        <h1 className="flex-1 truncate text-2xl font-bold">{team.name}</h1>
        {isOwner && (
          <button
            className="text-xs text-danger hover:underline"
            onClick={() => void deleteTeam()}
          >
            Delete team
          </button>
        )}
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[1.4fr_1fr]">
        {/* shared prompt library */}
        <div className="divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-raised">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold">Shared prompts</h2>
          </div>
          {prompts.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-dim">
              Nothing shared yet. Set a prompt's visibility to “Team” to
              publish it here.
            </p>
          )}
          {prompts.map((p) => (
            <div key={p.id} className="group px-4 py-3 transition-colors hover:bg-hover">
              <div className="flex items-baseline gap-2">
                <span className="flex-1 truncate text-sm font-semibold">
                  {p.title}
                </span>
                {copiedId === p.id && (
                  <span className="text-xs font-bold text-accent">Copied</span>
                )}
                <button
                  className="btn px-2 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => copy(p)}
                >
                  Copy
                </button>
              </div>
              <p className="mt-1 line-clamp-2 font-mono text-xs leading-relaxed text-dim">
                {p.body}
              </p>
              <p className="mt-2 flex items-center gap-3 text-xs text-dim">
                {p.visibility === "public" && (
                  <span className="vis-badge text-accent">public</span>
                )}
                <span>
                  by {p.authorName}
                  {p.useCount > 0 && (
                    <span className="tabular-nums"> · {p.useCount}×</span>
                  )}
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* members */}
        <div className="divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-raised">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold">
              Members
              {members && (
                <span className="ml-1.5 tabular-nums text-dim">
                  ({members.members.length})
                </span>
              )}
            </h2>
          </div>
          {members?.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 px-4 py-2.5 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint text-xs font-semibold text-accent">
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{m.name}</span>
                <span className="block truncate text-xs text-dim">{m.email}</span>
              </span>
              <span className="text-xs capitalize text-dim">{m.role}</span>
              {isOwner && m.userId !== session?.user.id && (
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={() => void removeMember(m.userId)}
                >
                  remove
                </button>
              )}
              {!isOwner && m.userId === session?.user.id && (
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={() => void removeMember(m.userId)}
                >
                  leave
                </button>
              )}
            </div>
          ))}
          {members && members.invites.length > 0 && (
            <div className="px-4 py-2.5 text-xs text-dim">
              Invited, awaiting acceptance:{" "}
              {members.invites.map((i) => i.email).join(", ")}
            </div>
          )}
          {isOwner && (
            <div className="space-y-2 px-4 py-3">
              <div className="flex gap-2">
                <input
                  className="input"
                  type="email"
                  placeholder="teammate@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void invite()}
                />
                <button className="btn-primary" onClick={() => void invite()}>
                  Invite
                </button>
              </div>
              {message && <p className="text-xs text-accent">{message}</p>}
            </div>
          )}

          {/* owner-only: estimated token spend per member, last 30 days */}
          {isOwner && usage.length > 0 && (
            <div className="px-4 py-3">
              <h2 className="text-sm font-semibold">Token spend</h2>
              <p className="mb-2 text-xs text-dim">
                Estimated (message chars ÷ 4), last 30 days — not billing data.
              </p>
              <div className="divide-y divide-line">
                {usage.map((u) => (
                  <div
                    key={`${u.userId}-${u.site}`}
                    className="flex items-center gap-2 py-1.5 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate">{u.name}</span>
                    <span className="chip">{u.site}</span>
                    <span className="tabular-nums text-dim">
                      ~{u.tokens >= 1000 ? `${(u.tokens / 1000).toFixed(1)}k` : u.tokens}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
