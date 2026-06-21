import { describe, expect, it } from "vitest";
import { findAll, replaceAll } from "./search";

describe("findAll", () => {
  it("returns empty for empty query", () => {
    const result = findAll("hello world", "", { caseSensitive: false, useRegex: false });
    expect(result.count).toBe(0);
    expect(result.indices).toEqual([]);
  });

  it("finds single match", () => {
    const result = findAll("hello world", "world", { caseSensitive: false, useRegex: false });
    expect(result.count).toBe(1);
    expect(result.indices).toEqual([6]);
  });

  it("finds multiple matches", () => {
    const result = findAll("abc abc abc", "abc", { caseSensitive: false, useRegex: false });
    expect(result.count).toBe(3);
    expect(result.indices).toEqual([0, 4, 8]);
  });

  it("respects case sensitivity", () => {
    const result = findAll("Hello hello HELLO", "hello", { caseSensitive: true, useRegex: false });
    expect(result.count).toBe(1);
    expect(result.indices).toEqual([6]);
  });

  it("handles case insensitive search", () => {
    const result = findAll("Hello hello HELLO", "hello", { caseSensitive: false, useRegex: false });
    expect(result.count).toBe(3);
  });

  it("handles regex search", () => {
    const result = findAll("abc 123 def 456", "\\d+", { caseSensitive: false, useRegex: true });
    expect(result.count).toBe(2);
    expect(result.indices).toEqual([4, 12]);
  });

  it("handles invalid regex gracefully", () => {
    const result = findAll("hello", "[invalid", { caseSensitive: false, useRegex: true });
    expect(result.count).toBe(0);
  });

  it("handles overlapping matches in regex", () => {
    const result = findAll("aba", "a", { caseSensitive: false, useRegex: true });
    expect(result.count).toBe(2);
    expect(result.indices).toEqual([0, 2]);
  });
});

describe("replaceAll", () => {
  it("replaces all occurrences", () => {
    const result = replaceAll("hello world hello", "hello", "hi", {
      caseSensitive: false,
      useRegex: false
    });
    expect(result).toBe("hi world hi");
  });

  it("respects case sensitivity", () => {
    const result = replaceAll("Hello hello", "hello", "hi", {
      caseSensitive: true,
      useRegex: false
    });
    expect(result).toBe("Hello hi");
  });

  it("handles regex replacement", () => {
    const result = replaceAll("abc 123 def 456", "\\d+", "NUM", {
      caseSensitive: false,
      useRegex: true
    });
    expect(result).toBe("abc NUM def NUM");
  });

  it("returns original for empty query", () => {
    const result = replaceAll("hello", "", "world", { caseSensitive: false, useRegex: false });
    expect(result).toBe("hello");
  });

  it("handles special regex characters in literal mode", () => {
    const result = replaceAll("price is $5.00", "$5.00", "€4.50", {
      caseSensitive: false,
      useRegex: false
    });
    expect(result).toBe("price is €4.50");
  });
});
