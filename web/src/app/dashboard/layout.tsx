"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-dim">
        Loading…
      </div>
    );
  }

  const resendVerification = async () => {
    await authClient.sendVerificationEmail({
      email: session.user.email,
      callbackURL: "/dashboard",
    });
    setVerifySent(true);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {!session.user.emailVerified && (
          <div className="flex items-center gap-3 border-b border-line bg-tint px-8 py-2.5 text-sm">
            <span className="text-ink">
              Verify your email to publish public prompts and join teams.
            </span>
            {verifySent ? (
              <span className="font-semibold text-accent">
                Verification link sent — check your inbox.
              </span>
            ) : (
              <button
                className="font-semibold text-accent hover:underline"
                onClick={() => void resendVerification()}
              >
                Resend link
              </button>
            )}
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
