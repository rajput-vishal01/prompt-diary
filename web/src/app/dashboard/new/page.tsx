"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PromptEditor } from "@/components/PromptEditor";

export default function NewPromptPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const folder = useSearchParams().get("folder");
  return <PromptEditor id={null} defaultFolderId={folder} />;
}
