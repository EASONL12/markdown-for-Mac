import { describe, expect, it } from "vitest";
import {
  createSessionSnapshot,
  restoreSessionSnapshot,
  type PlainMarkSessionSnapshot
} from "./session";
import { createInitialWorkspace, updateActiveContent } from "./documentModel";

describe("session persistence", () => {
  it("stores workspace documents, active document, view mode, and theme mode", () => {
    const workspace = updateActiveContent(createInitialWorkspace(), "# Draft");

    const snapshot = createSessionSnapshot(workspace, "preview", "dark", {
      autoSave: true,
      defaultViewMode: "read",
      fontSize: 18,
      lineHeight: 1.8,
      readingWidth: 900
    }, {
      "/tmp/a.md": {
        cursorEnd: 3,
        cursorStart: 1,
        previewScrollTop: 100,
        textareaScrollTop: 50,
        viewMode: "preview"
      }
    });

    expect(snapshot).toEqual({
      version: 2,
      readingPositions: {
        "/tmp/a.md": {
          cursorEnd: 3,
          cursorStart: 1,
          previewScrollTop: 100,
          textareaScrollTop: 50,
          viewMode: "preview"
        }
      },
      readingSettings: {
        autoSave: true,
        defaultViewMode: "read",
        fontSize: 18,
        lineHeight: 1.8,
        readingWidth: 900
      },
      workspace,
      viewMode: "preview",
      themeMode: "dark"
    });
  });

  it("restores a valid v2 snapshot and preserves dirty document state", () => {
    const workspace = updateActiveContent(createInitialWorkspace(), "# Draft");
    const snapshot: PlainMarkSessionSnapshot = {
      version: 2,
      readingPositions: {},
      readingSettings: {
        autoSave: false,
        defaultViewMode: "read",
        fontSize: 18,
        lineHeight: 1.8,
        readingWidth: 900
      },
      workspace,
      viewMode: "read",
      themeMode: "light"
    };

    const restored = restoreSessionSnapshot(JSON.stringify(snapshot));

    expect(restored?.workspace.documents).toHaveLength(1);
    expect(restored?.workspace.documents[0].content).toBe("# Draft");
    expect(restored?.workspace.documents[0].isDirty).toBe(true);
    expect(restored?.viewMode).toBe("read");
    expect(restored?.themeMode).toBe("light");
    expect(restored?.readingSettings.autoSave).toBe(false);
  });

  it("restores legacy v1 sessions with default reading settings and no positions", () => {
    const workspace = updateActiveContent(createInitialWorkspace(), "# Draft");
    const restored = restoreSessionSnapshot(JSON.stringify({
      version: 1,
      workspace,
      viewMode: "split",
      themeMode: "system"
    }));

    expect(restored?.version).toBe(2);
    expect(restored?.readingSettings.defaultViewMode).toBe("split");
    expect(restored?.readingPositions).toEqual({});
  });

  it("ignores invalid stored session data", () => {
    expect(restoreSessionSnapshot("not json")).toBeNull();
    expect(restoreSessionSnapshot(JSON.stringify({ version: 2 }))).toBeNull();
    expect(restoreSessionSnapshot(JSON.stringify({ version: 1, workspace: { documents: [] } }))).toBeNull();
  });
});
