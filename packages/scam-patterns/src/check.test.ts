import { describe, expect, it } from "vitest";
import { checkDataset } from "./check";
import { dataset } from "./index";

const copy = () => structuredClone(dataset);

describe("scam pattern dataset", () => {
  it("passes every check", () => {
    expect(checkDataset(dataset)).toEqual([]);
  });

  it("has at least 8 patterns", () => {
    expect(dataset.patterns.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects a pattern without an official source", () => {
    const data = copy();
    data.patterns[0]!.sourceRefs = ["doj-elder-hotline"];
    expect(checkDataset(data).join("\n")).toMatch(/DOJ sources may only back help resources/);
  });

  it("rejects an unknown source reference", () => {
    const data = copy();
    data.warningSigns[0]!.sourceRefs = ["made-up"];
    expect(checkDataset(data).join("\n")).toMatch(/unknown source "made-up"/);
  });

  it("rejects a source outside official domains", () => {
    const data = copy();
    data.sources["ftc-romance"]!.url = "https://example.com/romance";
    expect(checkDataset(data).length).toBeGreaterThan(0);
  });

  it("rejects an unknown sign in a pattern", () => {
    const data = copy();
    data.patterns[0]!.signIds.push("not-a-sign");
    expect(checkDataset(data).join("\n")).toMatch(/unknown sign "not-a-sign"/);
  });
});
