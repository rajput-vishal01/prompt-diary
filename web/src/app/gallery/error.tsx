"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusScreen } from "@/components/StatusScreen";

// Gallery-scoped error boundary — a failure browsing the gallery must not
// blow past to the full-screen root boundary.
export default function GalleryError({
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
      title="The gallery hit a snag"
      message="Something went wrong loading the community's prompts. Try again, or head back home."
    >
      <button className="btn-primary" onClick={() => reset()}>
        Try again
      </button>
      <button className="btn" onClick={() => router.push("/")}>
        Home
      </button>
      {error.digest && (
        <p className="mt-2 w-full font-mono text-[11px] text-dim">Reference: {error.digest}</p>
      )}
    </StatusScreen>
  );
}
