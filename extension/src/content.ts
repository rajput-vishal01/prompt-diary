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
    color: #13271e;
    border: 1px solid #dde4de;
    border-radius: 8px;
    padding: 5px 10px;
    font: 600 12px/1 system-ui, sans-serif;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(19, 39, 30, 0.14);
    user-select: none;
  }
  .pd-bubble:hover, .pd-composer:hover {
    background: #e7f0ea;
    border-color: #1c6b4a;
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
    color: #1c6b4a;
    font-size: 13px;
  }
  .pd-toast {
    position: fixed;
    z-index: 2147483647;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    background: #13271e;
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

function savePrompt(body: string) {
  const text = body.trim();
  if (!text) return;
  const title =
    text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trimEnd()}…` : text;
  chrome.runtime.sendMessage(
    { type: "save-prompt", title, body: text },
    (res?: { ok?: boolean }) => {
      showToast(res?.ok ? "Saved to Prompt Diary ✓" : "Could not save — is the extension enabled?");
    },
  );
}

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

function makeMessageButton(target: HTMLElement): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Pd · Save";
  btn.title = "Save this message to Prompt Diary";
  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    marginTop: "6px",
    padding: "3px 9px",
    font: "600 11px/1.4 system-ui, sans-serif",
    color: "#1c6b4a",
    background: "transparent",
    border: "1px solid rgba(28, 107, 74, 0.35)",
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
    savePrompt(text);
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
    if ((el.innerText ?? "").trim().length < MIN_SELECTION) continue;
    el.dataset[PD_MARKER] = "1";
    el.appendChild(makeMessageButton(el));
  }
}
