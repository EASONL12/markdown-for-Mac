import { describe, expect, it } from "vitest";
import {
  createDefaultReadingSettings,
  sanitizeReadingSettings
} from "./readingSettings";

describe("reading settings", () => {
  it("provides conservative defaults for reading and light editing", () => {
    expect(createDefaultReadingSettings()).toEqual({
      autoSave: true,
      defaultViewMode: "split",
      fontSize: 16,
      lineHeight: 1.72,
      readingWidth: 820
    });
  });

  it("clamps restored settings to supported ranges", () => {
    expect(sanitizeReadingSettings({
      autoSave: false,
      defaultViewMode: "read",
      fontSize: 40,
      lineHeight: 0.5,
      readingWidth: 2000
    })).toEqual({
      autoSave: false,
      defaultViewMode: "read",
      fontSize: 22,
      lineHeight: 1.4,
      readingWidth: 1100
    });
  });
});

