"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatusScreen } from "@/components/StatusScreen";

// Route-level error boundary (App Router). Catches render/data errors in any
// page under the root and offers a recovery path instead of a blank screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      title="Something went wrong"
      message="An unexpected error broke this page. You can try again, or head back home — your saved prompts are safe."
    >
      <button className="btn-primary" onClick={() => reset()}>
        Try again
      </button>
      <Link href="/" className="btn">
        Go home
      </Link>
      {error.digest && (
        <p className="mt-2 w-full font-mono text-[11px] text-dim">Reference: {error.digest}</p>
      )}
    </StatusScreen>
  );
}
