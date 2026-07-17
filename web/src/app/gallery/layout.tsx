import type { Metadata } from "next";

// the gallery page is a client component, so its metadata lives here
export const metadata: Metadata = {
  title: "Public prompt gallery",
  description:
    "Browse the community's best AI prompts and multi-step prompt recipes. Copy any of them into your own diary with one click.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: "Public prompt gallery — Prompt Diary",
    description:
      "Browse the community's best AI prompts and multi-step prompt recipes.",
    url: "/gallery",
  },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
