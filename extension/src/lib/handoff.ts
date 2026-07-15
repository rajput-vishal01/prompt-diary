// Context transfer between AI chat models: capture a conversation on one
// site, carry it locally, insert it into another model's composer.
// Standalone module (no imports) so the content-script bundle stays lean.

export interface HandoffMessage {
  role?: "user" | "assistant"; // undefined = couldn't be determined
  text: string;
}

export interface Handoff {
  site: string; // chatgpt | claude | gemini
  url: string; // origin+pathname fingerprint of the source conversation
  title: string;
  capturedAt: string; // ISO
  messages: HandoffMessage[];
  charCount: number; // post-truncation
  truncated: boolean;
}

// ~15k tokens — fits every target model's context and every composer
export const MAX_HANDOFF_CHARS = 60_000;

const EXPIRY_MS = 24 * 60 * 60 * 1000; // stale context is worse than none

export async function getHandoff(): Promise<Handoff | null> {
  const res = await chrome.storage.local.get("handoff");
  const h = res["handoff"] as Handoff | undefined;
  if (!h) return null;
  if (Date.now() - new Date(h.capturedAt).getTime() > EXPIRY_MS) {
    await chrome.storage.local.remove("handoff");
    return null;
  }
  return h;
}

export async function setHandoff(h: Handoff | null): Promise<void> {
  if (h) await chrome.storage.local.set({ handoff: h });
  else await chrome.storage.local.remove("handoff");
}

const SITE_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
};

export const siteName = (site: string) => SITE_NAMES[site] ?? site;

// the text block pasted into the new model's composer — the code owns this
// template so every handoff reads the same regardless of source site
export function buildHandoffText(h: Handoff): string {
  const date = new Date(h.capturedAt).toLocaleDateString();
  const omitted = h.truncated ? " Earlier messages were omitted for length." : "";
  const turns = h.messages
    .map((m) => {
      const label = m.role === "user" ? "User: " : m.role === "assistant" ? "Assistant: " : "";
      return `${label}${m.text}`;
    })
    .join("\n\n");
  return [
    `[Context from a previous ${siteName(h.site)} conversation ("${h.title}", captured ${date}).${omitted} Transcript follows.]`,
    "",
    turns,
    "",
    "[End of context. Continue this conversation from where it left off — treat the transcript above as our shared history.]",
  ].join("\n");
}
