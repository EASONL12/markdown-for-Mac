import { describe, expect, it } from "vitest";
import {
  findPreviewScrollTop,
  findPreviewScrollTopForSourceLine,
  findSourceLineForPreviewScrollTop,
  findTextareaScrollTop,
  findTextareaScrollTopForSourceLine,
  findTextareaSourceLine
} from "./scrollSync";

describe("findPreviewScrollTop", () => {
  it("returns 0 when textarea is not scrollable", () => {
    const result = findPreviewScrollTop(0, 500, 500, 1000, 500);
    expect(result).toBe(0);
  });

  it("maps textarea scroll to preview scroll", () => {
    const result = findPreviewScrollTop(250, 1000, 500, 2000, 500);
    expect(result).toBe(750);
  });

  it("returns 0 when textarea is at top", () => {
    const result = findPreviewScrollTop(0, 1000, 500, 2000, 500);
    expect(result).toBe(0);
  });

  it("returns max when textarea is at bottom", () => {
    const result = findPreviewScrollTop(500, 1000, 500, 2000, 500);
    expect(result).toBe(1500);
  });
});

describe("findTextareaScrollTop", () => {
  it("returns 0 when preview is not scrollable", () => {
    const result = findTextareaScrollTop(0, 500, 500, 1000, 500);
    expect(result).toBe(0);
  });

  it("maps preview scroll to textarea scroll", () => {
    const result = findTextareaScrollTop(500, 2000, 500, 1000, 500);
    expect(result).toBeCloseTo(166.67);
  });

  it("returns 0 when preview is at top", () => {
    const result = findTextareaScrollTop(0, 2000, 500, 1000, 500);
    expect(result).toBe(0);
  });

  it("returns max when preview is at bottom", () => {
    const result = findTextareaScrollTop(1500, 2000, 500, 1000, 500);
    expect(result).toBe(500);
  });
});

describe("source-line anchored scrolling", () => {
  const anchors = [
    { line: 0, scrollTop: 0 },
    { line: 10, scrollTop: 240 },
    { line: 20, scrollTop: 900 }
  ];

  it("maps a source line to the nearest interpolated preview scroll position", () => {
    expect(findPreviewScrollTopForSourceLine(10, anchors, 1000)).toBe(240);
    expect(findPreviewScrollTopForSourceLine(15, anchors, 1000)).toBe(570);
  });

  it("clamps source-line preview scrolling to available bounds", () => {
    expect(findPreviewScrollTopForSourceLine(-1, anchors, 1000)).toBe(0);
    expect(findPreviewScrollTopForSourceLine(40, anchors, 500)).toBe(500);
  });

  it("maps preview scroll position back to an interpolated source line", () => {
    expect(findSourceLineForPreviewScrollTop(240, anchors, 20)).toBe(10);
    expect(findSourceLineForPreviewScrollTop(570, anchors, 20)).toBe(15);
  });

  it("maps textarea scroll position and source line using line height", () => {
    expect(findTextareaSourceLine(48, 24, 12)).toBe(2);
    expect(findTextareaSourceLine(900, 24, 12)).toBe(11);
    expect(findTextareaScrollTopForSourceLine(5, 24, 300)).toBe(120);
  });
});
