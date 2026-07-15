import { describe, expect, test } from "bun:test";
import { publicIdFromUrl } from "../src/lib/cloudinary";

describe("publicIdFromUrl", () => {
  test("parses versioned upload URLs", () => {
    expect(
      publicIdFromUrl(
        "https://res.cloudinary.com/demo/image/upload/v1712345678/prompt-diary/user123/abc-def.png",
      ),
    ).toBe("prompt-diary/user123/abc-def");
  });

  test("parses unversioned URLs and keeps folder structure", () => {
    expect(
      publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/prompt-diary/u1/x.webp"),
    ).toBe("prompt-diary/u1/x");
  });

  test("returns null for non-cloudinary URLs", () => {
    expect(publicIdFromUrl("https://evil.example.com/image/upload/v1/prompt-diary/u1/x.png")).toBeNull();
  });

  test("ownership prefix is preserved so the user-folder guard works", () => {
    const id = publicIdFromUrl(
      "https://res.cloudinary.com/demo/image/upload/v1/prompt-diary/USER_A/pic.jpg",
    );
    expect(id?.startsWith("prompt-diary/USER_A/")).toBe(true);
    expect(id?.startsWith("prompt-diary/USER_B/")).toBe(false);
  });
});
