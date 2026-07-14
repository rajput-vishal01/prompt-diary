"use client";

import { useParams } from "next/navigation";
import { PromptEditor } from "@/components/PromptEditor";

export default function PromptPage() {
  const { id } = useParams<{ id: string }>();
  return <PromptEditor id={id} />;
}
