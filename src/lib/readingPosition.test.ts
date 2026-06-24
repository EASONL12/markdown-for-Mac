import { describe, expect, it } from "vitest";
import {
  getDocumentPositionKey,
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
      viewMode: "read"
    });
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
});

