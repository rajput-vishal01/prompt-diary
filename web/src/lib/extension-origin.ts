// EXTENSION_IDS pins which chrome extensions may call the API with
// credentials. Unset = trust any chrome-extension:// origin (dev-friendly:
// unpacked installs get a new id per machine). In prod, set it to your
// published extension id(s), comma-separated, so a random malicious extension
// the user installed can't ride their session.
// Pure string logic only — imported by middleware (edge runtime) and auth.
const allowedIds = (process.env.EXTENSION_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isAllowedExtensionOrigin(origin: string): boolean {
  if (!origin.startsWith("chrome-extension://")) return false;
  if (allowedIds.length === 0) return true;
  return allowedIds.includes(origin.slice("chrome-extension://".length));
}
