import { describe, expect, it } from "vitest";
import { checkText, extractFromHtml, extractFromJson, lintSource } from "./lint-copy";

describe("checkText", () => {
  it("accepts calm, plain copy", () => {
    expect(checkText("I'm glad you asked me first.")).toEqual([]);
    expect(checkText("Call 833 372 8311 on weekdays.")).toEqual([]);
    expect(checkText("A follow up message")).toEqual([]);
  });

  it("flags emojis", () => {
    expect(checkText("Done ✅")).toContain("emoji");
  });

  it("flags en and em dashes", () => {
    expect(checkText("Wait — then call")).toContain("dash");
    expect(checkText("10–12")).toContain("dash");
  });

  it("flags spaced and double hyphens", () => {
    expect(checkText("Wait - then call")).toContain("spaced-hyphen");
    expect(checkText("Wait--then call")).toContain("spaced-hyphen");
    expect(checkText("- first item")).toContain("spaced-hyphen");
  });

  it("flags the word AI but not words that contain those letters", () => {
    expect(checkText("Powered by AI")).toContain("ai-word");
    expect(checkText("AI helps you")).toContain("ai-word");
    expect(checkText("A.I. assistant")).toContain("ai-word");
    expect(checkText("MAIN menu, said, wait")).toEqual([]);
  });
});

describe("extraction", () => {
  it("reads string literals and JSX text, skips imports and keys", () => {
    const source = [
      'import x from "some-module";',
      'const copy = { "key-with-dash": "Calm text" };',
      "const el = <p>Smart AI help</p>;",
    ].join("\n");
    const violations = lintSource("view.tsx", source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ line: 3, rule: "ai-word" });
  });

  it("honors copy-lint-ignore on the previous line", () => {
    const source = ["// copy-lint-ignore", 'const bad = "Wait — now";'].join("\n");
    expect(lintSource("x.ts", source)).toEqual([]);
  });

  it("reads HTML text and labelled attributes, not scripts", () => {
    const html =
      '<div aria-label="Signs — found"><script>const a = "x - y";</script><p>Fine</p></div>';
    const texts = extractFromHtml(html).map((s) => s.text);
    expect(texts).toContain("Signs — found");
    expect(texts).toContain("Fine");
    expect(texts.join(" ")).not.toContain("x - y");
  });

  it("reads JSON values but skips urls and ids", () => {
    const json = JSON.stringify({ id: "a-b", url: "https://x.gov/a--b", label: "Gift cards" });
    expect(extractFromJson(json).map((s) => s.text)).toEqual(["Gift cards"]);
  });
});
