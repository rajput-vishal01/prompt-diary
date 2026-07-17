import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Select } from "@/components/ui/Select";

// The glass Select's one sharp edge: Radix's <Value> only learns item text
// when items mount (first open), so a naive trigger SSRs blank. We render the
// selected label from the options list ourselves — these lock that in.

const opts = [
  { value: "", label: "All visibility" },
  { value: "private", label: "private" },
  { value: "public", label: "public" },
];

describe("Select trigger", () => {
  test("shows the selected option's label without opening", () => {
    const html = renderToString(<Select value="public" onValueChange={() => {}} options={opts} />);
    expect(html).toContain(">public<");
  });

  test("empty-string value (the 'none' option) shows its label, not a blank", () => {
    // also proves the "" sentinel works — Radix throws on value="" items
    const html = renderToString(<Select value="" onValueChange={() => {}} options={opts} />);
    expect(html).toContain("All visibility");
  });

  test("is a real combobox with the app's trigger styling", () => {
    const html = renderToString(
      <Select value="private" onValueChange={() => {}} ariaLabel="Visibility" options={opts} />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Visibility"');
    expect(html).toContain("select-trigger");
  });

  test("unknown value degrades to an empty label instead of crashing", () => {
    const html = renderToString(<Select value="ghost" onValueChange={() => {}} options={opts} />);
    expect(html).toContain('role="combobox"');
  });
});
