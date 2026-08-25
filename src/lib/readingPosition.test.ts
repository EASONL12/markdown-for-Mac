import { describe, expect, it } from "vitest";
import {
  ensureReadingPositionViewMode,
  getDocumentPositionKey,
  getDocumentViewMode,
  limitReadingPositions,
  rekeyReadingPosition,
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

  it("seeds a missing active document with the restored session view mode", () => {
    const seeded = ensureReadingPositionViewMode({}, "/docs/readme.md", "preview");

    expect(seeded["/docs/readme.md"]).toMatchObject({
      cursorEnd: 0,
      cursorStart: 0,
      previewScrollTop: 0,
      textareaScrollTop: 0,
      viewMode: "preview"
    });
    expect(ensureReadingPositionViewMode(seeded, "/docs/readme.md", "read")).toBe(seeded);
  });

  it("moves a saved position to a new path without resetting it", () => {
    const position = {
      cursorEnd: 8,
      cursorStart: 4,
      previewScrollTop: 120,
      textareaScrollTop: 40,
      viewMode: "read" as const
    };

    const moved = rekeyReadingPosition({ untitled: position }, "untitled", "/docs/readme.md");

    expect(moved.untitled).toBeUndefined();
    expect(moved["/docs/readme.md"]).toBe(position);
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
