"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { api } from "@/lib/client-api";
import { useSession } from "@/lib/auth-client";
import { dialog } from "@/components/Dialog";
import { toast } from "@/components/Toast";

interface TeamRow {
  id: string;
  name: string;
  ownerId: string;
  role: "owner" | "member";
  createdAt: string;
  memberCount: number;
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

// brass is reserved for exactly two things app-wide: the active-row indicator
// and team role tags — this is the role tag
function RoleTag({ role }: { role: string }) {
  return (
    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-brass">
      {role}
    </span>
  );
}

export default function TeamsPage() {
  return (
    <Suspense>
      <TeamsPageInner />
    </Suspense>
  );
}

function TeamsPageInner() {
  const searchParams = useSearchParams();
  const teamParam = searchParams.get("t"); // sidebar deep-link
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [selected, setSelected] = useState<TeamRow | null>(null);

  const reload = () => {
    void api<TeamRow[]>("/api/v1/teams").then((rows) => {
      setTeams(rows);
      setSelected((cur) => rows.find((r) => r.id === cur?.id) ?? null);
    });
    void api<InviteRow[]>("/api/v1/invites").then(setInvites);
  };

  useEffect(reload, []);

  // ?t=<id> from the sidebar opens that team directly
  useEffect(() => {
    if (!teamParam) {
      setSelected(null);
      return;
    }
    setSelected(teams.find((t) => t.id === teamParam) ?? null);
  }, [teamParam, teams]);

  const createTeam = async () => {
    const name = await dialog.prompt({ title: "New team", placeholder: "Team name", submitLabel: "Create" });
    if (!name?.trim()) return;
    try {
      await api("/api/v1/teams", { method: "POST", body: { name: name.trim() } });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create team", { kind: "error" });
    }
  };

  const answerInvite = async (id: string, action: "accept" | "decline") => {
    try {
      await api(`/api/v1/invites/${id}`, { method: "POST", body: { action } });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update invite", { kind: "error" });
    }
  };

  if (selected) {
    return (
      <TeamDetail team={selected} onBack={() => setSelected(null)} onChanged={reload} />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-light tracking-[-0.01em] text-ink">
            Teams
          </h1>
          <p className="mt-1 text-sm text-dim">
            Shared prompt libraries — set a prompt&apos;s visibility to
            “Team” to publish it to everyone here.
          </p>
        </div>
        <button className="btn-primary" onClick={() => void createTeam()}>
          + New team
        </button>
      </div>

      {/* pending invites — a banner strip, not a card */}
      {invites.length > 0 && (
        <div className="mb-6 divide-y divide-line overflow-hidden rounded-xl bg-tint">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <p className="flex-1 text-sm text-ink">
                <span className="font-semibold">{inv.invitedByName}</span> invited
                you to <span className="font-semibold">{inv.teamName}</span>
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
          invite from this page.
        </p>
      ) : (
        /* two-line 64px rows — the same ledger language as My Prompts */
        <div className="panel divide-y divide-line">
          {teams.map((t) => (
            <button
              key={t.id}
              className="ledger-row group flex h-16 w-full cursor-pointer items-center gap-4 px-4 text-left transition-colors duration-[120ms] ease-out hover:bg-soft"
              onClick={() => setSelected(t)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint font-display text-base font-light text-ink">
                {t.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium leading-6 text-ink">
                  {t.name}
                </span>
                <span className="block text-sm leading-5 text-dim">
                  {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                </span>
              </span>
              <RoleTag role={t.role} />
              <span className="text-dim transition-transform duration-[120ms] group-hover:translate-x-0.5 group-hover:text-ink">
                →
              </span>
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
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [usageGated, setUsageGated] = useState(false);
  const isOwner = team.role === "owner";

  const reloadDetail = () => {
    void api<MembersData>(`/api/v1/teams/${team.id}/members`).then(setMembers);
    void api<TeamPrompt[]>(`/api/v1/teams/${team.id}/prompts`).then(setPrompts);
    if (team.role === "owner")
      void api<TeamUsageRow[]>(`/api/v1/teams/${team.id}/usage`)
        .then((rows) => {
          setUsage(rows);
          setUsageGated(false);
        })
        .catch((e: unknown) => {
          // 402 = analytics is behind the Pro plan on this deployment
          if (e instanceof Error && e.message.includes("Pro plan")) setUsageGated(true);
        });
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
    setConfirmingRemove(null);
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

  const spendTotal = usage.reduce((sum, u) => sum + u.tokens, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-body transition-colors hover:bg-hover hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={15} /> Teams
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-light tracking-[-0.01em] text-ink">
          {team.name}
        </h1>
        {isOwner && (
          <button
            className="rounded-lg px-2 py-1.5 text-sm text-danger transition-colors hover:bg-danger/5"
            onClick={() => void deleteTeam()}
          >
            Delete team
          </button>
        )}
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[1.4fr_1fr]">
        {/* shared prompt library — manuscript rows */}
        <section>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
            Shared prompts
          </p>
          <div className="panel divide-y divide-line">
            {prompts.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-dim">
                Nothing shared yet. Set a prompt&apos;s visibility to “Team” to
                publish it here.
              </p>
            )}
            {prompts.map((p) => (
              <div
                key={p.id}
                className="group px-4 py-3.5 transition-colors duration-[120ms] ease-out hover:bg-soft"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                    {p.title}
                  </span>
                  <button
                    aria-label="Copy prompt"
                    title={copiedId === p.id ? "Copied!" : "Copy prompt"}
                    className="hidden h-8 w-8 items-center justify-center rounded-lg text-dim transition-colors hover:bg-ink/[0.06] hover:text-ink group-hover:flex"
                    onClick={() => copy(p)}
                  >
                    <Copy size={14} className={copiedId === p.id ? "text-success" : ""} />
                  </button>
                </div>
                <p className="mt-1 line-clamp-2 font-mono text-xs leading-relaxed tracking-tight text-dim">
                  {p.body}
                </p>
                <p className="mt-1.5 text-xs text-dim">
                  by {p.authorName}
                  {p.useCount > 0 && <span className="tabular-nums"> · {p.useCount}×</span>}
                  {p.visibility === "public" && <span> · also public</span>}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-8">
          {/* members */}
          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
              Members{members && <span className="tabular-nums"> · {members.members.length}</span>}
            </p>
            <div className="panel divide-y divide-line">
              {members?.members.map((m) => {
                const isSelf = m.userId === session?.user.id;
                const canRemove = (isOwner && !isSelf) || (!isOwner && isSelf);
                return (
                  <div
                    key={m.userId}
                    className="group flex h-16 items-center gap-3 px-4 transition-colors duration-[120ms] ease-out hover:bg-soft"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-xs font-semibold text-ink">
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {m.name}
                        {isSelf && <span className="font-normal text-dim"> (you)</span>}
                      </span>
                      <span className="block truncate text-xs text-dim">{m.email}</span>
                    </span>
                    <RoleTag role={m.role} />
                    {canRemove &&
                      (confirmingRemove === m.userId ? (
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          <button
                            className="font-medium text-danger hover:underline"
                            onClick={() => void removeMember(m.userId)}
                          >
                            {isSelf ? "Leave" : "Remove"}
                          </button>
                          <button
                            className="text-dim hover:text-ink"
                            onClick={() => setConfirmingRemove(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          className="hidden shrink-0 text-xs text-danger hover:underline group-hover:block"
                          onClick={() => setConfirmingRemove(m.userId)}
                        >
                          {isSelf ? "leave" : "remove"}
                        </button>
                      ))}
                  </div>
                );
              })}
              {members && members.invites.length > 0 && (
                <div className="px-4 py-2.5 text-xs text-dim">
                  Invited, awaiting acceptance: {members.invites.map((i) => i.email).join(", ")}
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
                  {message && <p className="text-xs text-dim">{message}</p>}
                </div>
              )}
            </div>
          </section>

          {/* owner-only quiet upgrade prompt — analytics is Pro-gated here */}
          {isOwner && usageGated && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                Token spend
              </p>
              <div className="panel px-4 py-4">
                <p className="text-sm leading-relaxed text-dim">
                  Per-member usage analytics is part of the Pro plan.
                </p>
                <button
                  className="btn-primary mt-3"
                  onClick={() =>
                    void api<{ url: string }>("/api/v1/billing/checkout", { method: "POST" })
                      .then(({ url }) => {
                        window.location.href = url;
                      })
                      .catch(() => toast("Could not open checkout", { kind: "error" }))
                  }
                >
                  Upgrade to Pro
                </button>
              </div>
            </section>
          )}

          {/* owner-only: headline spend + the door to the full dashboard */}
          {isOwner && usage.length > 0 && (
            <section>
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-dim">
                  Token spend
                </p>
                <Link
                  href={`/dashboard/teams/${team.id}/usage`}
                  className="text-xs font-medium text-dim transition-colors hover:text-ink"
                >
                  Full dashboard →
                </Link>
              </div>
              <Link
                href={`/dashboard/teams/${team.id}/usage`}
                className="panel block px-4 py-3 transition-colors hover:border-line-strong"
                title="Open the usage dashboard"
              >
                <p className="font-display text-2xl font-light tabular-nums text-ink">
                  ~{spendTotal >= 1000 ? `${(spendTotal / 1000).toFixed(1)}k` : spendTotal}
                </p>
                <p className="text-xs text-dim">
                  estimated tokens, last 30 days — not billing data
                </p>
                <p className="mt-2 text-xs text-dim">
                  Daily trends, member leaderboard, and model split in the dashboard.
                </p>
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
