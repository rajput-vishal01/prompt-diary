import { describe, expect, test } from "bun:test";
import { promptFacets } from "shared";

describe("promptFacets", () => {
  test("detects few-shot from two example blocks", () => {
    expect(
      promptFacets("Classify sentiment.\nExample 1: great → positive\nExample 2: awful → negative"),
    ).toContain("few-shot");
    expect(promptFacets("Example 1: just one example")).not.toContain("few-shot");
  });

  test("detects few-shot from Input:/Output: pairs", () => {
    expect(
      promptFacets("Input: 2+2\nOutput: 4\nInput: 3+3\nOutput: 6"),
    ).toContain("few-shot");
  });

  test("detects chain-of-thought", () => {
    expect(promptFacets("Think step by step before answering.")).toContain("chain-of-thought");
    expect(promptFacets("Show your reasoning.")).toContain("chain-of-thought");
  });

  test("detects role-play", () => {
    expect(promptFacets("You are a senior copywriter with 20 years of experience.")).toContain("role-play");
    expect(promptFacets("Act as my interviewer.")).toContain("role-play");
    // "you are given" is instruction framing, not role assignment
    expect(promptFacets("You are given a list of numbers.")).not.toContain("role-play");
  });

  test("detects template slots", () => {
    expect(promptFacets("Write a {{tone}} email to {{recipient}}.")).toContain("template");
    expect(promptFacets("Summarize [ARTICLE TEXT] in three lines.")).toContain("template");
    expect(promptFacets("Plain prompt with no slots.")).not.toContain("template");
  });

  test("a prompt can match several facets at once", () => {
    const body =
      "You are a translator. Think step by step.\nExample 1: hola → hello\nExample 2: adios → bye\nTranslate {{word}}.";
    const f = promptFacets(body);
    expect(f).toEqual(
      expect.arrayContaining(["role-play", "chain-of-thought", "few-shot", "template"]),
    );
  });

  test("plain prompt matches nothing", () => {
    expect(promptFacets("Summarize this article in two sentences.")).toEqual([]);
  });
});
