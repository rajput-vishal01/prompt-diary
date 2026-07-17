import { addPrompt } from "./lib/vault";
import {
  flushUsageEvents,
  getActiveThread,
  getUsageTimestamps,
  queueThreadStep,
  recordUsageEvent,
} from "./lib/api";

// while "record to thread" is on, every fresh save queues as the next step
async function maybeRecord(promptId: string, duplicate: boolean): Promise<string | null> {
  if (duplicate) return null;
  const active = await getActiveThread();
  if (!active) return null;
  await queueThreadStep(active.id, promptId);
  return active.title;
}

const MENU_ID = "save-to-prompt-diary";
const TITLE_MAX = 60;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save to Prompt Diary",
    contexts: ["selection"],
  });
});

function flashBadge(text: string) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#292524" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
}

// auto-tag saves with the site they came from — free organization
function siteTag(url: string | undefined): string[] {
  if (!url) return [];
  try {
    const host = new URL(url).hostname;
    if (/chatgpt|openai/.test(host)) return ["chatgpt"];
    if (/claude\.ai/.test(host)) return ["claude"];
    if (/gemini\.google/.test(host)) return ["gemini"];
    if (/perplexity/.test(host)) return ["perplexity"];
    if (/poe\.com/.test(host)) return ["poe"];
    return [];
  } catch {
    return [];
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  const text = info.selectionText.trim();
  if (!text) return;

  const title =
    text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trimEnd()}…` : text;

  void addPrompt({ title, body: text, tags: siteTag(tab?.url) }).then(async (r) => {
    await maybeRecord(r.prompt.id, r.duplicate);
    flashBadge(r.duplicate ? "=" : "+1");
  });
});

// usage-limit tracker: content scripts can't call our API (page-origin CORS),
// so the worker records events (local + server queue) and serves counts back
type Buckets = { standard: number[]; reasoning: number[] };
let serverFetchCache: { site: string; at: number; buckets: Buckets } | null = null;

chrome.runtime.onMessage.addListener(
  (
    msg: { type?: string; site?: string; reasoning?: boolean; model?: string },
    _sender,
    sendResponse,
  ) => {
    if (msg?.type === "usage-msg" && msg.site) {
      void recordUsageEvent(msg.site, { reasoning: msg.reasoning, model: msg.model })
        .then(() => flushUsageEvents())
        .then(() => {
          serverFetchCache = null; // count changed — next read refetches
          sendResponse({ ok: true });
        })
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
    if (msg?.type === "get-usage" && msg.site) {
      const site = msg.site;
      // 60s cache keeps the widget's tick from hammering the server
      if (serverFetchCache && serverFetchCache.site === site && Date.now() - serverFetchCache.at < 60_000) {
        sendResponse({ buckets: serverFetchCache.buckets });
        return;
      }
      void getUsageTimestamps(site)
        .then((buckets) => {
          serverFetchCache = { site, at: Date.now(), buckets };
          sendResponse({ buckets });
        })
        .catch(() => sendResponse({ buckets: { standard: [], reasoning: [] } }));
      return true;
    }
    return;
  },
);

// one-click saves from the content script (selection bubble / composer / messages)
chrome.runtime.onMessage.addListener(
  (
    msg: { type?: string; title?: string; body?: string; sourceConvo?: string },
    sender,
    sendResponse,
  ) => {
    if (msg?.type !== "save-prompt" || !msg.body?.trim()) return;
    void addPrompt({
      title: msg.title ?? msg.body.slice(0, TITLE_MAX),
      body: msg.body,
      tags: siteTag(sender.tab?.url ?? sender.url),
      sourceConvo: msg.sourceConvo ?? null,
    })
      .then(async (r) => {
        const threadTitle = await maybeRecord(r.prompt.id, r.duplicate);
        flashBadge(r.duplicate ? "=" : "+1");
        sendResponse({ ok: true, duplicate: r.duplicate, threadTitle });
      })
      .catch(() => sendResponse({ ok: false }));
    return true; // async response
  },
);
