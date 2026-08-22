import { describe, expect, it } from "vitest";
import {
  getDocumentPositionKey,
  getDocumentViewMode,
  limitReadingPositions,
  sanitizeReadingPositions,
  updateReadingPosition
} from "./readingPosition";

describe("reading position memory", () => {
  it("uses a file path as the stable key when present", () => {
    expect(getDocumentPositionKey({ id: "tmp", path: "/docs/readme.md" })).toBe("/docs/readme.md");
  });

  it("stores scroll, cursor, and view mode per document key", () => {
    const positions = updateReadingPosition({}, "/docs/readme.md", {
      cursorEnd: 8,
      cursorStart: 4,
      previewScrollTop: 120,
      textareaScrollTop: 40,
      viewMode: "read"
    });

    expect(positions["/docs/readme.md"]).toEqual({
      cursorEnd: 8,
      cursorStart: 4,
      previewScrollTop: 120,
      textareaScrollTop: 40,
      viewMode: "read",
      savedAt: expect.any(Number)
    });
  });

  it("uses the default view only when a document has no remembered view", () => {
    const positions = {
      "/docs/readme.md": {
        cursorEnd: 0,
        cursorStart: 0,
        previewScrollTop: 0,
        textareaScrollTop: 0,
        viewMode: "preview" as const
      }
    };

    expect(getDocumentViewMode(positions, "/docs/readme.md", "read")).toBe("preview");
    expect(getDocumentViewMode(positions, "/docs/new.md", "read")).toBe("read");
  });

  it("drops invalid restored positions", () => {
    expect(sanitizeReadingPositions({
      ok: {
        cursorEnd: 2,
        cursorStart: 1,
        previewScrollTop: 10,
        textareaScrollTop: 5,
        viewMode: "split"
      },
      broken: { previewScrollTop: -1 }
    })).toEqual({
      ok: {
        cursorEnd: 2,
        cursorStart: 1,
        previewScrollTop: 10,
        textareaScrollTop: 5,
        viewMode: "split"
      }
    });
  });

  it("limits stored positions to the newest entries", () => {
    const positions = {
      oldest: { cursorEnd: 0, cursorStart: 0, previewScrollTop: 0, textareaScrollTop: 0, viewMode: "read" as const },
      newer: { cursorEnd: 0, cursorStart: 0, previewScrollTop: 0, textareaScrollTop: 0, viewMode: "read" as const, savedAt: 100 },
      newest: { cursorEnd: 0, cursorStart: 0, previewScrollTop: 0, textareaScrollTop: 0, viewMode: "read" as const, savedAt: 200 }
    };

    const limited = limitReadingPositions(positions, 2);

    expect(Object.keys(limited)).toEqual(["newer", "newest"]);
    // At or under the cap the input is returned untouched.
    expect(limitReadingPositions(limited, 2)).toBe(limited);
  });
});
