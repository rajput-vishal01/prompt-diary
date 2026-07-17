// Known chat sources — the same pill everywhere, only the dot color differs,
// desaturated on purpose (never a filled colored badge).
export const SOURCE_DOTS: Record<string, string> = {
  chatgpt: "hsl(160 25% 50%)",
  claude: "hsl(24 30% 55%)",
  gemini: "hsl(217 30% 58%)",
  perplexity: "hsl(190 25% 48%)",
  poe: "hsl(260 22% 56%)",
};

/** The site a prompt was saved from, read off its auto-tags. */
export const sourceOf = (p: { tags: string[] }) =>
  p.tags.find((t) => t in SOURCE_DOTS) ?? null;

export function relativeTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 604800)}w ago`;
}
