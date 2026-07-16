"use client";

import { useParams } from "next/navigation";
import { PromptEditor } from "@/components/PromptEditor";

export default function PromptPage() {
  const { id } = useParams<{ id: string }>();
  // key={id} remounts the editor when navigating between prompts: it flushes
  // the previous prompt's pending autosave (unmount effect) and resets all
  // state, so the new prompt never briefly shows the old one's title/body.
  return <PromptEditor key={id} id={id} />;
}
