// Runs on AI chat sites (see manifest content_scripts matches).
// Two save surfaces, both rendered in a closed shadow root so site CSS
// can't touch them:
//  1. selection bubble — select any text, click Pd, it's in the vault
//  2. composer button — docked at the chatbox, saves your draft pre-send

import {
  PLAN_LABELS,
  bucketLimit,
  isReasoningModel,
  limitState,
  pruneWindow,
  resetEta,
  siteForHost,
  type Plan,
} from "./lib/limits";

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
  .pd-limit {
    position: fixed;
    z-index: 2147483646;
    right: 16px;
    bottom: 16px;
    display: none;
    flex-direction: column;
    gap: 6px;
    background: #ffffff;
    color: #0c0a09;
    border: 1px solid #e7e5e4;
    border-radius: 10px;
    padding: 8px 12px;
    font: 500 11.5px/1.4 system-ui, sans-serif;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    user-select: none;
    min-width: 150px;
  }
  .pd-limit-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pd-limit-head .pd-mark { font-size: 12px; }
  .pd-limit-count { margin-left: auto; font-variant-numeric: tabular-nums; color: #57534e; }
  .pd-limit-bar {
    height: 4px;
    border-radius: 9999px;
    background: #f0efed;
    overflow: hidden;
  }
  .pd-limit-fill {
    height: 100%;
    border-radius: 9999px;
    background: #292524;
    width: 0%;
    transition: width 300ms ease-out;
  }
  .pd-limit.warn .pd-limit-fill { background: #8a5a06; }
  .pd-limit.over .pd-limit-fill { background: #dc2626; }
  .pd-limit-note { color: #57534e; font-size: 10.5px; display: none; }
  .pd-limit.over .pd-limit-note { display: block; color: #dc2626; font-weight: 600; }
  .pd-limit-panel { display: none; flex-direction: column; gap: 6px; border-top: 1px solid #e7e5e4; padding-top: 7px; margin-top: 2px; }
  .pd-limit.open .pd-limit-panel { display: flex; }
  .pd-limit-plans { display: flex; gap: 4px; }
  .pd-limit-plan {
    flex: 1;
    border: 1px solid #d6d3d1;
    background: transparent;
    color: #57534e;
    border-radius: 9999px;
    padding: 3px 0;
    font: 500 10.5px/1 system-ui, sans-serif;
    cursor: pointer;
  }
  .pd-limit-plan.active { background: #292524; border-color: #292524; color: #fff; }
  .pd-limit-est { color: #a8a29e; font-size: 10px; }
  /* the head doubles as the drag handle */
  .pd-limit-head { cursor: move; }
  .pd-limit.dragging { transition: none; box-shadow: 0 8px 28px rgba(0,0,0,0.16); }
  .pd-limit.dragging .pd-limit-fill, .pd-limit.dragging .pd-limit-subfill { transition: none; }
  .pd-limit-model {
    display: flex; align-items: center; gap: 5px;
    color: #57534e; font-size: 10.5px; margin-top: -2px;
  }
  .pd-limit-model .pd-model-name {
    max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-weight: 600; color: #0c0a09;
  }
  .pd-limit-think {
    flex-shrink: 0; background: #f7ead6; color: #8a5a06;
    border-radius: 9999px; padding: 1px 6px; font-size: 9.5px; font-weight: 700;
    letter-spacing: 0.02em;
  }
  /* reasoning bucket sub-row — only shown once thinking sends exist */
  .pd-limit-sub { display: none; flex-direction: column; gap: 3px; }
  .pd-limit-sub.show { display: flex; }
  .pd-limit-sub-head {
    display: flex; align-items: center; gap: 6px;
    font-size: 10px; color: #8a5a06; font-weight: 600;
  }
  .pd-limit-sub-count { margin-left: auto; font-variant-numeric: tabular-nums; }
  .pd-limit-subbar { height: 3px; border-radius: 9999px; background: #f7ead6; overflow: hidden; }
  .pd-limit-subfill {
    height: 100%; border-radius: 9999px; background: #8a5a06; width: 0%;
    transition: width 300ms ease-out;
  }
  .pd-limit-sub.over .pd-limit-subfill { background: #dc2626; }
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
// one cheap tick handles composer re-docking, new-message buttons, and
// keeping the limit widget's window fresh as time passes
setInterval(() => {
  if (finder) dockComposerButton();
  injectMessageButtons();
  updateLimitWidget();
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

// ---------- usage-limit widget ----------
// SEND-EVENT tracking: a message is counted the moment the user submits it
// (Enter in the composer / a send-button click) — never by observing rendered
// messages, so a refresh or an old conversation can't corrupt the count.
// Events are recorded by the background worker: server-side when signed in
// (survives refresh/reinstall, follows the user across devices), local log
// otherwise. Limits are estimates; three states: ok → nearing → reached.

const TRACK_SITE = siteForHost(location.hostname); // any supported model site

type Buckets = { standard: number[]; reasoning: number[] };
let usageBuckets: Buckets = { standard: [], reasoning: [] };
let sitePlan: Plan = "free";
let lastSendAt = 0; // debounce: Enter + send-click for one message = one event
let detected: { model: string; thinking: boolean } = { model: "", thinking: false };

const modelText = (el: Element | null | undefined) => (el?.textContent ?? "").trim();

// Best-effort model + thinking-mode detection from the page DOM. Selectors rot,
// so each site scans defensively and degrades to {model:"", thinking:false}.
function detectModel(): { model: string; thinking: boolean } {
  const key = TRACK_SITE?.key;
  const thinkOn = () =>
    [...document.querySelectorAll('[aria-pressed="true"], [data-state="on"]')].some((e) => {
      const s = `${modelText(e)} ${e.getAttribute("aria-label") ?? ""}`;
      return /think|reason/i.test(s);
    });
  try {
    if (key === "chatgpt") {
      const btn =
        document.querySelector('[data-testid="model-switcher-dropdown-button"]') ??
        document.querySelector('button[aria-label*="model" i]') ??
        [...document.querySelectorAll("main button, header button")].find((b) =>
          /gpt|o[134]\b|thinking/i.test(modelText(b)),
        );
      const model = modelText(btn).replace(/^chatgpt\s*/i, "").slice(0, 40) || "GPT";
      return { model, thinking: isReasoningModel(model) || thinkOn() };
    }
    if (key === "claude") {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /claude|sonnet|opus|haiku|fable/i.test(modelText(b)),
      );
      const model = modelText(btn).slice(0, 40) || "Claude";
      return { model, thinking: isReasoningModel(model) || thinkOn() };
    }
    if (key === "gemini") {
      const btn = [...document.querySelectorAll("button, [role='button']")].find((b) =>
        /2\.\d|flash|pro|gemini/i.test(modelText(b)),
      );
      const model = modelText(btn).replace(/^gemini\s*/i, "").slice(0, 40) || "Gemini";
      return { model, thinking: isReasoningModel(model) || thinkOn() };
    }
  } catch {
    // detection must never throw into the host page
  }
  return { model: "", thinking: false };
}

function refreshUsage() {
  if (!TRACK_SITE) return;
  chrome.runtime.sendMessage(
    { type: "get-usage", site: TRACK_SITE.key },
    (res?: { buckets?: Buckets }) => {
      if (chrome.runtime.lastError || !res?.buckets) return;
      usageBuckets = res.buckets;
      updateLimitWidget();
    },
  );
}

if (TRACK_SITE) {
  void chrome.storage.local.get("sitePlans").then((res) => {
    const plans = (res["sitePlans"] as Record<string, Plan> | undefined) ?? {};
    sitePlan = plans[TRACK_SITE.key] ?? "free";
    detected = detectModel();
    buildLimitWidget();
    refreshUsage();
  });
  setInterval(refreshUsage, 30_000); // background caches server reads for 60s
  // re-detect the model/mode periodically — users switch mid-session
  setInterval(() => {
    const next = detectModel();
    if (next.model !== detected.model || next.thinking !== detected.thinking) {
      detected = next;
      updateLimitWidget();
    }
  }, 3000);

  const editableText = (t: EventTarget | null): string | null => {
    if (t instanceof HTMLTextAreaElement) return t.value;
    if (t instanceof HTMLInputElement && t.type === "text") return t.value;
    if (t instanceof HTMLElement && t.isContentEditable) return t.innerText;
    return null;
  };

  const recordSend = () => {
    const now = Date.now();
    if (now - lastSendAt < 1500) return; // Enter and click both fired
    lastSendAt = now;
    detected = detectModel();
    const reasoning = detected.thinking || isReasoningModel(detected.model);
    // optimistic bucket bump — instant UI, reconciled on next refresh
    if (reasoning) usageBuckets = { ...usageBuckets, reasoning: [...usageBuckets.reasoning, now] };
    else usageBuckets = { ...usageBuckets, standard: [...usageBuckets.standard, now] };
    updateLimitWidget();
    const site = TRACK_SITE.key;
    const model = detected.model;
    chrome.runtime.sendMessage({ type: "usage-msg", site, reasoning, model }, () => {
      // worker unreachable (context invalidated after a reload) → persist here so
      // the send isn't lost. Local log is bucketed; tolerate the pre-bucket shape.
      if (chrome.runtime.lastError) {
        void chrome.storage.local.get(["usageEvents", "usageLocalLog"]).then((res) => {
          const queue =
            (res["usageEvents"] as Array<{ site: string; at: number; reasoning: boolean; model: string }>) ?? [];
          queue.push({ site, at: now, reasoning, model });
          const raw = (res["usageLocalLog"] ?? {}) as Record<string, unknown>;
          const cur = raw[site];
          const b: Buckets = Array.isArray(cur)
            ? { standard: cur as number[], reasoning: [] }
            : cur && typeof cur === "object"
              ? {
                  standard: (cur as Partial<Buckets>).standard ?? [],
                  reasoning: (cur as Partial<Buckets>).reasoning ?? [],
                }
              : { standard: [], reasoning: [] };
          if (reasoning) b.reasoning = [...b.reasoning, now];
          else b.standard = [...b.standard, now];
          raw[site] = b;
          void chrome.storage.local.set({ usageEvents: queue.slice(-500), usageLocalLog: raw });
        });
      }
    });
  };

  // Enter (or Ctrl/Cmd+Enter) in a non-empty composer = a send, on EVERY site —
  // no per-site selectors to rot
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      const text = editableText(e.target);
      if (text && text.trim().length > 0) recordSend();
    },
    true,
  );

  // send-button clicks (common patterns) while a composer holds text
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target instanceof Element ? e.target : null;
      const btn = el?.closest(
        "button[data-testid*='send' i], button[aria-label*='send' i], button[type='submit']",
      );
      if (!btn) return;
      const composer = finder?.() ?? document.querySelector<HTMLElement>("textarea, [contenteditable='true']");
      const text = composer ? (composer instanceof HTMLTextAreaElement ? composer.value : composer.innerText) : "";
      if (text.trim().length > 0) recordSend();
    },
    true,
  );
}

// widget DOM (inside the same closed shadow root)
const limitBox = document.createElement("div");
limitBox.className = "pd-limit";
shadow.appendChild(limitBox);

let dragMoved = false; // set true after a drag so the ensuing click doesn't toggle

function clampPos(x: number, y: number): { x: number; y: number } {
  const r = limitBox.getBoundingClientRect();
  const w = r.width || 160;
  const h = r.height || 60;
  return {
    x: Math.min(Math.max(4, x), Math.max(4, window.innerWidth - w - 4)),
    y: Math.min(Math.max(4, y), Math.max(4, window.innerHeight - h - 4)),
  };
}

function applyPos(x: number, y: number) {
  limitBox.style.left = `${x}px`;
  limitBox.style.top = `${y}px`;
  limitBox.style.right = "auto";
  limitBox.style.bottom = "auto";
}

function restorePos() {
  void chrome.storage.local.get("pdLimitPos").then((res) => {
    const p = res["pdLimitPos"] as { x: number; y: number } | undefined;
    if (p) {
      const c = clampPos(p.x, p.y);
      applyPos(c.x, c.y);
    } else {
      // default: bottom-right but lifted well off the bottom edge so the panel
      // has room to expand downward without overflowing off-screen
      const r = limitBox.getBoundingClientRect();
      applyPos(window.innerWidth - (r.width || 160) - 20, window.innerHeight - (r.height || 60) - 96);
    }
  });
}

// after the panel expands, the box is taller/wider — shift it up/left so the
// whole thing stays on screen instead of overflowing below the viewport
function fitInView() {
  const r = limitBox.getBoundingClientRect();
  const c = clampPos(r.left, r.top);
  if (Math.round(c.x) !== Math.round(r.left) || Math.round(c.y) !== Math.round(r.top)) {
    applyPos(c.x, c.y);
  }
}

function makeDraggable() {
  const head = limitBox.querySelector<HTMLElement>(".pd-limit-head");
  if (!head) return;
  head.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const r = limitBox.getBoundingClientRect();
    const origX = r.left;
    const origY = r.top;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    head.setPointerCapture(e.pointerId);
    limitBox.classList.add("dragging");
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      const c = clampPos(origX + dx, origY + dy);
      applyPos(c.x, c.y);
    };
    const up = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      limitBox.classList.remove("dragging");
      if (moved) {
        dragMoved = true;
        const rr = limitBox.getBoundingClientRect();
        void chrome.storage.local.set({ pdLimitPos: { x: rr.left, y: rr.top } });
        setTimeout(() => (dragMoved = false), 0);
      }
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
  });
}

function buildLimitWidget() {
  if (!TRACK_SITE) return;
  limitBox.innerHTML = `
    <div class="pd-limit-head">
      <span class="pd-mark">Pd</span>
      <span class="pd-limit-label"></span>
      <span class="pd-limit-count"></span>
    </div>
    <div class="pd-limit-model">
      <span class="pd-model-name"></span>
      <span class="pd-limit-think">THINKING</span>
    </div>
    <div class="pd-limit-bar"><div class="pd-limit-fill"></div></div>
    <div class="pd-limit-sub">
      <div class="pd-limit-sub-head"><span>Thinking</span><span class="pd-limit-sub-count"></span></div>
      <div class="pd-limit-subbar"><div class="pd-limit-subfill"></div></div>
    </div>
    <div class="pd-limit-note"></div>
    <div class="pd-limit-panel">
      <div class="pd-limit-plans"></div>
      <span class="pd-limit-est">Estimated from your sends — not an official meter. Drag to move.</span>
    </div>`;
  const plansEl = limitBox.querySelector(".pd-limit-plans")!;
  (Object.keys(PLAN_LABELS) as Plan[]).forEach((p) => {
    const b = document.createElement("button");
    b.className = "pd-limit-plan";
    b.dataset["plan"] = p;
    b.textContent = PLAN_LABELS[p];
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      sitePlan = p;
      void chrome.storage.local.get("sitePlans").then((res) => {
        const plans = (res["sitePlans"] as Record<string, Plan> | undefined) ?? {};
        plans[TRACK_SITE!.key] = p;
        void chrome.storage.local.set({ sitePlans: plans });
      });
      updateLimitWidget();
    });
    plansEl.appendChild(b);
  });
  // click toggles the plan panel — but not when the click ends a drag
  limitBox.addEventListener("click", () => {
    if (dragMoved) return;
    limitBox.classList.toggle("open");
    fitInView(); // opening makes it taller — keep the whole panel on screen
  });
  limitBox.style.display = "flex";
  makeDraggable();
  restorePos();
  window.addEventListener("resize", () => {
    const r = limitBox.getBoundingClientRect();
    const c = clampPos(r.left, r.top);
    applyPos(c.x, c.y);
  });
  updateLimitWidget();
}

function updateLimitWidget() {
  if (!TRACK_SITE || limitBox.style.display === "none") return;
  const now = Date.now();
  const std = bucketLimit(TRACK_SITE.key, sitePlan, false);
  const rsn = bucketLimit(TRACK_SITE.key, sitePlan, true);
  const hasSeparateRsn =
    rsn.maxMessages !== std.maxMessages || rsn.windowHours !== std.windowHours;

  const stdIn = pruneWindow(usageBuckets.standard, std.windowHours, now);
  const rsnIn = pruneWindow(usageBuckets.reasoning, rsn.windowHours, now);
  // no separate reasoning cap → thinking sends just count as standard messages
  const primaryCount = hasSeparateRsn ? stdIn.length : stdIn.length + rsnIn.length;

  const stdState = limitState(primaryCount, std.maxMessages);
  const rsnState = hasSeparateRsn ? limitState(rsnIn.length, rsn.maxMessages) : "ok";
  const worst =
    stdState === "over" || rsnState === "over"
      ? "over"
      : stdState === "warn" || rsnState === "warn"
        ? "warn"
        : "ok";
  limitBox.classList.remove("warn", "over");
  if (worst !== "ok") limitBox.classList.add(worst);

  const q = (s: string) => limitBox.querySelector<HTMLElement>(s);
  const label = q(".pd-limit-label");
  const countEl = q(".pd-limit-count");
  const fill = q(".pd-limit-fill");
  const note = q(".pd-limit-note");
  const modelName = q(".pd-model-name");
  const thinkPill = q(".pd-limit-think");
  const sub = q(".pd-limit-sub");
  const subCount = q(".pd-limit-sub-count");
  const subFill = q(".pd-limit-subfill");
  if (!label || !countEl || !fill || !note) return;

  label.textContent = `${TRACK_SITE.name} · ${std.windowHours}h`;
  countEl.textContent =
    std.maxMessages === null ? `${primaryCount} · ∞` : `${primaryCount}/${std.maxMessages}`;
  fill.style.width =
    std.maxMessages === null ? "4%" : `${Math.min(100, (primaryCount / std.maxMessages) * 100)}%`;

  if (modelName) modelName.textContent = detected.model || "detecting model…";
  if (thinkPill) thinkPill.style.display = detected.thinking ? "inline-block" : "none";

  // reasoning sub-row: shown only when the site caps reasoning separately AND
  // the user has actually used thinking (or has it toggled on right now)
  if (sub && subCount && subFill) {
    const showSub = hasSeparateRsn && (rsnIn.length > 0 || detected.thinking);
    sub.classList.toggle("show", showSub);
    sub.classList.toggle("over", rsnState === "over");
    if (showSub) {
      const win = rsn.windowHours >= 168 ? `${Math.round(rsn.windowHours / 24)}d` : `${rsn.windowHours}h`;
      subCount.textContent =
        rsn.maxMessages === null ? `${rsnIn.length} · ∞` : `${rsnIn.length}/${rsn.maxMessages} · ${win}`;
      subFill.style.width =
        rsn.maxMessages === null ? "4%" : `${Math.min(100, (rsnIn.length / rsn.maxMessages) * 100)}%`;
    }
  }

  const rEta = resetEta(rsnIn, rsn.windowHours, now);
  const eta = resetEta(stdIn, std.windowHours, now);
  note.textContent =
    rsnState === "over"
      ? `Thinking limit likely reached${rEta ? ` · frees in ${rEta}` : ""}`
      : stdState === "over"
        ? `Limit likely reached${eta ? ` · frees in ${eta}` : ""}`
        : "";
  limitBox.querySelectorAll<HTMLElement>(".pd-limit-plan").forEach((b) => {
    b.classList.toggle("active", b.dataset["plan"] === sitePlan);
  });
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

// batch writes: storage once every 5s instead of per message. Key is now
// day|site|model so the spend dashboards can break usage down by model — "|"
// stripped from the label to keep the key delimiter unambiguous.
setInterval(() => {
  if (!SITE_KEY || pendingChars === 0) return;
  const tokens = Math.ceil(pendingChars / 4);
  pendingChars = 0;
  const model = (detected.model || "").replace(/\|/g, " ");
  const key = `${new Date().toISOString().slice(0, 10)}|${SITE_KEY}|${model}`;
  void chrome.storage.local.get("usagePending").then((res) => {
    const pending = (res["usagePending"] as Record<string, number>) ?? {};
    void chrome.storage.local.set({
      usagePending: { ...pending, [key]: (pending[key] ?? 0) + tokens },
    });
  });
}, 5000);

// idle label = the same Georgia-italic "Pd" mark as the composer pill, so the
// message button reads as the brand and stays legible on any chat background
const PD_SAVE_LABEL =
  '<span style="font-family:Georgia,serif;font-style:italic;font-weight:700;color:#0c0a09">Pd</span>' +
  '<span style="color:#0c0a09">Save</span>';

function makeMessageButton(target: HTMLElement): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset["pdBtn"] = "1"; // transcript capture hides these before reading innerText
  btn.innerHTML = PD_SAVE_LABEL;
  btn.title = "Save this message to Prompt Diary";
  // white pill (matches the .pd-composer / .pd-bubble look) — a solid light
  // surface with its own border + shadow reads on light AND dark chat UIs;
  // the old transparent+dark-ink style vanished on dark sites like ChatGPT
  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    marginTop: "6px",
    padding: "3px 9px",
    font: "600 11px/1.4 system-ui, sans-serif",
    color: "#0c0a09",
    background: "#ffffff",
    border: "1px solid #e7e5e4",
    borderRadius: "8px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.14)",
    opacity: "0.95",
  } satisfies Partial<CSSStyleDeclaration>);
  btn.addEventListener("mouseenter", () => {
    btn.style.opacity = "1";
    btn.style.background = "#f0efed";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.opacity = "0.95";
    btn.style.background = "#ffffff";
  });
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
          btn.innerHTML = PD_SAVE_LABEL;
          btn.style.opacity = "0.95";
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
