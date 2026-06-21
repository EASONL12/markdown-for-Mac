import { describe, expect, it } from "vitest";
import { findPreviewScrollTop, findTextareaScrollTop } from "./scrollSync";

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
