"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusScreen } from "@/components/StatusScreen";

// Dashboard-scoped error boundary: renders inside the dashboard layout, so the
// sidebar stays and only the content column shows the recovery message.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      compact
      title="This page hit a snag"
      message="Something went wrong loading this view. Try again, or jump back to your prompts."
    >
      <button className="btn-primary" onClick={() => reset()}>
        Try again
      </button>
      <button className="btn" onClick={() => router.push("/dashboard")}>
        My prompts
      </button>
      {error.digest && (
        <p className="mt-2 w-full font-mono text-[11px] text-dim">Reference: {error.digest}</p>
      )}
    </StatusScreen>
  );
}
