import { describe, expect, test } from "bun:test";
import { buildHandoffText, type Handoff } from "../src/lib/handoff";

const base: Handoff = {
  site: "chatgpt",
  url: "https://chatgpt.com/c/abc",
  title: "API design help",
  capturedAt: new Date().toISOString(),
  messages: [
    { role: "user", text: "Design a REST API for a todo app" },
    { role: "assistant", text: "Here's a resource-oriented design…" },
    { text: "unlabeled turn" },
  ],
  charCount: 100,
  truncated: false,
};

describe("buildHandoffText", () => {
  test("labels roles and wraps with preamble + closing instruction", () => {
    const out = buildHandoffText(base);
    expect(out).toContain('previous ChatGPT conversation ("API design help"');
    expect(out).toContain("User: Design a REST API");
    expect(out).toContain("Assistant: Here's a resource-oriented design…");
    expect(out).toContain("\n\nunlabeled turn"); // no label when role unknown
    expect(out).toContain("[End of context. Continue this conversation");
    expect(out).not.toContain("omitted for length");
  });

  test("notes truncation in the preamble", () => {
    expect(buildHandoffText({ ...base, truncated: true })).toContain(
      "Earlier messages were omitted for length.",
    );
  });
});
