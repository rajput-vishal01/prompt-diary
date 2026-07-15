import { describe, expect, test } from "bun:test";
import { limitState, pruneWindow, resetEta } from "../src/lib/limits";

const HOUR = 3_600_000;

describe("limitState — the three cases", () => {
  test("ok when comfortably under", () => {
    expect(limitState(10, 80)).toBe("ok");
  });
  test("warn when nearing (≥70%)", () => {
    expect(limitState(56, 80)).toBe("warn");
    expect(limitState(55, 80)).toBe("ok");
  });
  test("over when reached", () => {
    expect(limitState(80, 80)).toBe("over");
    expect(limitState(90, 80)).toBe("over");
  });
  test("unlimited plans never warn", () => {
    expect(limitState(9999, null)).toBe("ok");
  });
});

describe("rolling window", () => {
  test("pruneWindow drops timestamps outside the window", () => {
    const now = Date.now();
    const stamps = [now - 4 * HOUR, now - 2 * HOUR, now - 1000];
    expect(pruneWindow(stamps, 3, now)).toEqual([now - 2 * HOUR, now - 1000]);
  });

  test("resetEta reports when the oldest message frees a slot", () => {
    const now = Date.now();
    expect(resetEta([now - 2 * HOUR], 3, now)).toBe("~1h 0m");
    expect(resetEta([], 3, now)).toBeNull();
  });
});
