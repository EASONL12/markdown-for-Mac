import { describe, expect, it } from "vitest";
import { findPreviewScrollTop, findTextareaScrollTop } from "./scrollSync";

describe("findPreviewScrollTop", () => {
  it("returns 0 for empty line offsets", () => {
    const result = findPreviewScrollTop(0, 1000, 500, new Map(), 2000, 500);
    expect(result).toBe(0);
  });

  it("maps textarea scroll to preview scroll", () => {
    const lineOffsets = new Map([
      [0, 0],
      [10, 100],
      [20, 200]
    ]);

    const result = findPreviewScrollTop(250, 500, 250, lineOffsets, 400, 200);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(200);
  });

  it("returns 0 when textarea is at top", () => {
    const lineOffsets = new Map([
      [0, 0],
      [10, 100]
    ]);

    const result = findPreviewScrollTop(0, 500, 250, lineOffsets, 400, 200);
    expect(result).toBe(0);
  });

  it("handles single line offset", () => {
    const lineOffsets = new Map([[0, 0]]);

    const result = findPreviewScrollTop(100, 500, 250, lineOffsets, 400, 200);
    expect(result).toBe(0);
  });
});

describe("findTextareaScrollTop", () => {
  it("returns 0 for empty line offsets", () => {
    const result = findTextareaScrollTop(0, 2000, 500, new Map(), 1000, 500);
    expect(result).toBe(0);
  });

  it("maps preview scroll to textarea scroll", () => {
    const lineOffsets = new Map([
      [0, 0],
      [10, 100],
      [20, 200]
    ]);

    const result = findTextareaScrollTop(100, 400, 200, lineOffsets, 500, 250);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(250);
  });

  it("returns 0 when preview is at top", () => {
    const lineOffsets = new Map([
      [0, 0],
      [10, 100]
    ]);

    const result = findTextareaScrollTop(0, 400, 200, lineOffsets, 500, 250);
    expect(result).toBe(0);
  });

  it("handles single line offset", () => {
    const lineOffsets = new Map([[0, 0]]);

    const result = findTextareaScrollTop(100, 400, 200, lineOffsets, 500, 250);
    expect(result).toBe(0);
  });
});
