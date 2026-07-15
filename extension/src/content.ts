// Runs on AI chat sites (see manifest content_scripts matches).
// Two save surfaces, both rendered in a closed shadow root so site CSS
// can't touch them:
//  1. selection bubble — select any text, click Pd, it's in the vault
//  2. composer button — docked at the chatbox, saves your draft pre-send

const MIN_SELECTION = 10;
const TITLE_MAX = 60;

// ---------- shadow UI ----------

const host = document.createElement("div");
host.style.all = "initial";
const shadow = host.attachShadow({ mode: "closed" });

const style = document.createElement("style");
style.textContent = `
  .pd-bubble, .pd-composer {
    position: fixed;
    z-index: 2147483647;
    display: none;
    align-items: center;
    gap: 6px;
    background: #ffffff;
    color: #0c0a09;
    border: 1px solid #e7e5e4;
    border-radius: 8px;
    padding: 5px 10px;
    font: 600 12px/1 system-ui, sans-serif;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    user-select: none;
  }
  .pd-bubble:hover, .pd-composer:hover {
    background: #f0efed;
    border-color: #292524;
  }
  .pd-composer {
    padding: 4px 8px;
    opacity: 0.75;
  }
  .pd-composer:hover { opacity: 1; }
  .pd-mark {
    font-family: Georgia, serif;
    font-style: italic;
    font-weight: 700;
    color: #0c0a09;
    font-size: 13px;
  }
  .pd-toast {
    position: fixed;
    z-index: 2147483647;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    background: #0c0a09;
    color: #fff;
    border-radius: 8px;
    padding: 8px 16px;
    font: 600 12.5px/1 system-ui, sans-serif;
    display: none;
  }
`;
shadow.appendChild(style);

const bubble = document.createElement("button");
bubble.className = "pd-bubble";
bubble.innerHTML = `<span class="pd-mark">Pd</span> Save prompt`;
shadow.appendChild(bubble);

const composerBtn = document.createElement("button");
composerBtn.className = "pd-composer";
composerBtn.title = "Save this prompt to Prompt Diary";
composerBtn.innerHTML = `<span class="pd-mark">Pd</span>`;
shadow.appendChild(composerBtn);

const toast = document.createElement("div");
toast.className = "pd-toast";
shadow.appendChild(toast);

document.documentElement.appendChild(host);

let toastTimer = 0;
function showToast(text: string) {
  toast.textContent = text;
  toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.style.display = "none"), 1600);
}

// conversation fingerprint: origin + path identifies one chat session
// (chatgpt.com/c/<id>, claude.ai/chat/<id>…) — powers backward thread assembly
const sourceConvo = () => `${location.origin}${location.pathname}`.slice(0, 300);

function savePrompt(body: string) {
  const text = body.trim();
  if (!text) return;
  const title =
    text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trimEnd()}…` : text;
  chrome.runtime.sendMessage(
    { type: "save-prompt", title, body: text, sourceConvo: sourceConvo() },
    (res?: { ok?: boolean; duplicate?: boolean; threadTitle?: string | null }) => {
      showToast(
        !res?.ok
          ? "Could not save — is the extension enabled?"
          : res.duplicate
            ? "Already in your diary"
            : res.threadTitle
              ? `Saved → ${res.threadTitle} ✓`
              : "Saved to Prompt Diary ✓",
      );
    },
  );
}

// popup asks us to insert a prompt straight into the chatbox,
// or to capture the whole conversation as a context handoff
chrome.runtime.onMessage.addListener(
  (msg: { type?: string; body?: string }, _sender, sendResponse) => {
    if (msg?.type === "capture-transcript") {
      sendResponse(captureTranscript());
      return;
    }
    if (msg?.type !== "insert-prompt" || !msg.body) return;
    const el = finder?.();
    if (!el) {
      sendResponse({ ok: false });
      return;
    }
    el.focus();
    if (el instanceof HTMLTextAreaElement) {
      el.value = el.value ? `${el.value}\n${msg.body}` : msg.body;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // contenteditable (ProseMirror etc.) — execCommand keeps the editor's state in sync
      document.execCommand("insertText", false, msg.body);
    }
    showToast("Inserted from Prompt Diary ✓");
    sendResponse({ ok: true });
  },
);

// ---------- 1. selection bubble ----------

function currentSelectionText(): string {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return "";
  return sel.toString().trim();
}

function positionBubble() {
  const sel = window.getSelection();
  const text = currentSelectionText();
  if (!sel || text.length < MIN_SELECTION) {
    bubble.style.display = "none";
    return;
  }
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) {
    bubble.style.display = "none";
    return;
  }
  bubble.style.display = "flex";
  bubble.style.left = `${Math.max(8, rect.left + rect.width / 2 - 55)}px`;
  bubble.style.top = `${Math.max(8, rect.top - 38)}px`;
}

document.addEventListener("mouseup", () => setTimeout(positionBubble, 10));
document.addEventListener("keyup", (e) => {
  if (e.key === "Shift" || e.key.startsWith("Arrow")) positionBubble();
});
document.addEventListener("mousedown", () => (bubble.style.display = "none"));
document.addEventListener("scroll", () => (bubble.style.display = "none"), true);

bubble.addEventListener("mousedown", (e) => {
  // fires before the document mousedown-hide; also keeps the selection alive
  e.preventDefault();
  e.stopPropagation();
  savePrompt(currentSelectionText());
  bubble.style.display = "none";
});

// ---------- 2. composer button (per-site selectors) ----------
// ponytail: selector list per site; when a site redesigns, the selection
// bubble above keeps working while we update this list.

type ComposerFinder = () => HTMLElement | null;

const SITE_COMPOSERS: Array<{ host: RegExp; find: ComposerFinder }> = [
  {
    host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
    find: () => document.querySelector<HTMLElement>("#prompt-textarea"),
  },
  {
    host: /(^|\.)claude\.ai$/,
    find: () =>
      document.querySelector<HTMLElement>('div[contenteditable="true"].ProseMirror') ??
      document.querySelector<HTMLElement>('div[contenteditable="true"]'),
  },
  {
    host: /(^|\.)gemini\.google\.com$/,
    find: () => document.querySelector<HTMLElement>('div[contenteditable="true"]'),
  },
  {
    host: /(^|\.)perplexity\.ai$/,
    find: () => document.querySelector<HTMLElement>("textarea"),
  },
  {
    host: /(^|\.)poe\.com$/,
    find: () => document.querySelector<HTMLElement>("textarea"),
  },
];

const finder = SITE_COMPOSERS.find((c) => c.host.test(location.hostname))?.find;

function composerText(el: HTMLElement): string {
  return el instanceof HTMLTextAreaElement ? el.value : (el.innerText ?? "");
}

let composerEl: HTMLElement | null = null;

function dockComposerButton() {
  if (!finder) return;
  composerEl = finder();
  if (!composerEl) {
    composerBtn.style.display = "none";
    return;
  }
  const rect = composerEl.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    composerBtn.style.display = "none";
    return;
  }
  composerBtn.style.display = "flex";
  composerBtn.style.left = `${rect.right - 34}px`;
  composerBtn.style.top = `${Math.max(8, rect.top - 30)}px`;
}

// SPAs mount the chatbox late, move it around, and stream messages in —
// one cheap tick handles composer re-docking and new-message buttons
setInterval(() => {
  if (finder) dockComposerButton();
  injectMessageButtons();
}, 600);
if (finder) window.addEventListener("resize", dockComposerButton);

composerBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!composerEl) return;
  const text = composerText(composerEl);
  if (text.trim().length === 0) {
    showToast("Chatbox is empty — nothing to save");
    return;
  }
  savePrompt(text);
});

// ---------- 3. per-message save button ----------
// docked at the END of every finished assistant/user message, next to the
// site's own copy button. Injected into page DOM (inline styles only).

const MESSAGE_SELECTORS: Array<{ host: RegExp; selector: string }> = [
  {
    host: /chatgpt\.com|chat\.openai\.com/,
    selector: "[data-message-author-role]", // both your prompts and gpt's replies
  },
  {
    // claude redesigns often — anchor on data-is-streaming (stable for years,
    // present on every completed assistant turn) with class fallbacks
    host: /claude\.ai/,
    selector:
      "div[data-is-streaming='false'], div.font-claude-message, div.font-claude-response, div[data-testid='user-message']",
  },
  {
    host: /gemini\.google\.com/,
    selector: "message-content",
  },
];

const messageSelector = MESSAGE_SELECTORS.find((m) =>
  m.host.test(location.hostname),
)?.selector;

const PD_MARKER = "pdSaveInjected";

// ---------- context transfer: capture this conversation as a handoff ----------
// Walks the same MESSAGE_SELECTORS the save buttons use, in DOM order, and
// returns a role-labeled transcript. The popup stores it and inserts it into
// another model's composer so the user continues where they left off.

const MAX_HANDOFF_CHARS = 60_000; // keep in sync with lib/handoff.ts

const SITE_KEY_FOR_CAPTURE =
  /chatgpt\.com|chat\.openai\.com/.test(location.hostname)
    ? "chatgpt"
    : /claude\.ai/.test(location.hostname)
      ? "claude"
      : /gemini\.google\.com/.test(location.hostname)
        ? "gemini"
        : null;

function roleOf(el: HTMLElement): "user" | "assistant" | undefined {
  if (SITE_KEY_FOR_CAPTURE === "chatgpt") {
    const role = el.closest("[data-message-author-role]")?.getAttribute("data-message-author-role");
    return role === "user" ? "user" : role === "assistant" ? "assistant" : undefined;
  }
  if (SITE_KEY_FOR_CAPTURE === "claude") {
    if (el.closest("[data-testid='user-message']")) return "user";
    return "assistant"; // matched via font-claude-* / data-is-streaming ⇒ assistant turn
  }
  if (SITE_KEY_FOR_CAPTURE === "gemini") {
    // best effort — if the ancestor tag ever disappears this degrades to
    // unlabeled turns rather than mislabeling
    return el.closest("user-query") ? "user" : "assistant";
  }
  return undefined;
}

function captureTranscript():
  | { ok: true; handoff: Record<string, unknown> }
  | { ok: false; reason: "unsupported" | "empty" } {
  if (!messageSelector || !SITE_KEY_FOR_CAPTURE) return { ok: false, reason: "unsupported" };

  // outer nodes come first in querySelectorAll order, so containment dedupe
  // keeps the outermost match per message
  const accepted: HTMLElement[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(messageSelector)) {
    if (el.closest("[data-is-streaming='true']")) continue;
    if (accepted.some((a) => a.contains(el))) continue;
    accepted.push(el);
  }

  // our injected save buttons must not leak into the transcript
  const btns = document.querySelectorAll<HTMLElement>("[data-pd-btn]");
  btns.forEach((b) => (b.style.display = "none"));
  let messages = accepted
    .map((el) => ({ role: roleOf(el), text: el.innerText.trim() }))
    .filter((m) => m.text.length >= MIN_SELECTION);
  btns.forEach((b) => (b.style.display = "inline-flex"));

  if (messages.length === 0) return { ok: false, reason: "empty" };

  // truncate whole messages from the TOP — the newest turns matter most
  let total = messages.reduce((a, m) => a + m.text.length, 0);
  let truncated = false;
  while (total > MAX_HANDOFF_CHARS && messages.length > 1) {
    const dropped = messages.shift();
    total -= dropped?.text.length ?? 0;
    truncated = true;
  }
  const only = messages[0];
  if (only && total > MAX_HANDOFF_CHARS) {
    only.text = only.text.slice(-MAX_HANDOFF_CHARS);
    total = only.text.length;
    truncated = true;
  }

  return {
    ok: true,
    handoff: {
      site: SITE_KEY_FOR_CAPTURE,
      url: sourceConvo(),
      title: document.title.trim().slice(0, 80) || "Untitled conversation",
      capturedAt: new Date().toISOString(),
      messages,
      charCount: total,
      truncated,
    },
  };
}

// ---------- estimated token usage ----------
// every message we see (already deduped by PD_MARKER) adds chars÷4 tokens to
// a local per-site/day counter; sync flushes it to the server. Estimates only.

const SITE_KEY =
  [
    ["chatgpt", /chatgpt\.com|chat\.openai\.com/],
    ["claude", /claude\.ai/],
    ["gemini", /gemini\.google\.com/],
    ["perplexity", /perplexity\.ai/],
    ["poe", /poe\.com/],
  ].find(([, re]) => (re as RegExp).test(location.hostname))?.[0] as
    | string
    | undefined;

let pendingChars = 0;

function recordMessageChars(count: number) {
  pendingChars += count;
}

// batch writes: storage once every 5s instead of per message
setInterval(() => {
  if (!SITE_KEY || pendingChars === 0) return;
  const tokens = Math.ceil(pendingChars / 4);
  pendingChars = 0;
  const key = `${new Date().toISOString().slice(0, 10)}|${SITE_KEY}`;
  void chrome.storage.local.get("usagePending").then((res) => {
    const pending = (res["usagePending"] as Record<string, number>) ?? {};
    void chrome.storage.local.set({
      usagePending: { ...pending, [key]: (pending[key] ?? 0) + tokens },
    });
  });
}, 5000);

function makeMessageButton(target: HTMLElement): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset["pdBtn"] = "1"; // transcript capture hides these before reading innerText
  btn.textContent = "Pd · Save";
  btn.title = "Save this message to Prompt Diary";
  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    marginTop: "6px",
    padding: "3px 9px",
    font: "600 11px/1.4 system-ui, sans-serif",
    color: "#292524",
    background: "transparent",
    border: "1px solid rgba(41, 37, 36, 0.35)",
    borderRadius: "6px",
    cursor: "pointer",
    opacity: "0.7",
  } satisfies Partial<CSSStyleDeclaration>);
  btn.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
  btn.addEventListener("mouseleave", () => (btn.style.opacity = "0.7"));
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // innerText skips display:none nodes — hide our button so it's not saved
    btn.style.display = "none";
    const text = target.innerText;
    btn.style.display = "inline-flex";
    btn.textContent = "Saving…";
    chrome.runtime.sendMessage(
      {
        type: "save-prompt",
        title: text.slice(0, TITLE_MAX),
        body: text.trim(),
        sourceConvo: sourceConvo(),
      },
      (res?: { ok?: boolean; duplicate?: boolean }) => {
        if (chrome.runtime.lastError) {
          console.warn("[prompt-diary]", chrome.runtime.lastError.message);
        }
        // feedback ON the button — bottom toasts get missed
        btn.textContent = !res?.ok
          ? "Failed — reload extension"
          : res.duplicate
            ? "Already saved ="
            : "Saved ✓";
        btn.style.opacity = "1";
        setTimeout(() => {
          btn.textContent = "Pd · Save";
          btn.style.opacity = "0.7";
        }, 2000);
      },
    );
  });
  return btn;
}

function injectMessageButtons() {
  if (!messageSelector) return;
  for (const el of document.querySelectorAll<HTMLElement>(messageSelector)) {
    // closest() includes self — also prevents nested double-injection when
    // both a wrapper and an inner container match the selector list
    if (el.closest("[data-pd-save-injected='1']")) continue;
    // skip messages still streaming in (claude flags these)
    if (el.closest("[data-is-streaming='true']")) continue;
    const textLength = (el.innerText ?? "").trim().length;
    if (textLength < MIN_SELECTION) continue;
    el.dataset[PD_MARKER] = "1";
    recordMessageChars(textLength); // counted exactly once per message
    el.appendChild(makeMessageButton(el));
  }
}
