import { describe, expect, it } from "vitest";
import {
  addRecentFiles,
  getRecentDisplayName,
  removeRecentFile,
  restoreRecentFiles,
  type RecentFile
} from "./recentFiles";

describe("recentFiles", () => {
  it("adds paths newest first and deduplicates existing entries", () => {
    const existing: RecentFile[] = [
      { path: "/Users/easonlin/Notes/a.md", openedAt: 100 },
      { path: "/Users/easonlin/Notes/b.md", openedAt: 90 }
    ];

    const recent = addRecentFiles(existing, ["/Users/easonlin/Notes/b.md", "/Users/easonlin/Notes/c.md"], 200);

    expect(recent).toEqual([
      { path: "/Users/easonlin/Notes/c.md", openedAt: 201 },
      { path: "/Users/easonlin/Notes/b.md", openedAt: 200 },
      { path: "/Users/easonlin/Notes/a.md", openedAt: 100 }
    ]);
  });

  it("keeps only the ten newest entries", () => {
    const paths = Array.from({ length: 12 }, (_, index) => `/tmp/${index}.md`);

    const recent = addRecentFiles([], paths, 1000);

    expect(recent).toHaveLength(10);
    expect(recent[0].path).toBe("/tmp/11.md");
    expect(recent.at(-1)?.path).toBe("/tmp/2.md");
  });

  it("restores valid stored recent files and ignores invalid data", () => {
    const serialized = JSON.stringify([
      { path: "/tmp/a.md", openedAt: 1 },
      { path: "", openedAt: 2 },
      { path: "/tmp/b.md", openedAt: "old" }
    ]);

    expect(restoreRecentFiles(serialized)).toEqual([{ path: "/tmp/a.md", openedAt: 1 }]);
    expect(restoreRecentFiles("not json")).toEqual([]);
  });

  it("removes a recent path and derives readable display names", () => {
    const recent = [
      { path: "/Users/easonlin/Notes/a.md", openedAt: 100 },
      { path: "/Users/easonlin/Notes/b.md", openedAt: 90 }
    ];

    expect(removeRecentFile(recent, "/Users/easonlin/Notes/a.md")).toEqual([
      { path: "/Users/easonlin/Notes/b.md", openedAt: 90 }
    ]);
    expect(getRecentDisplayName("/Users/easonlin/Notes/a.md")).toBe("a.md");
  });
});
