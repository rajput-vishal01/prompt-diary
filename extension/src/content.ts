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

if (finder) {
  // SPAs mount the chatbox late and move it around — cheap re-dock loop
  setInterval(dockComposerButton, 600);
  window.addEventListener("resize", dockComposerButton);
}

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
