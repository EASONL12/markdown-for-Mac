import { describe, expect, it } from "vitest";
import {
  createSessionDocumentsPayload,
  createSessionPreferencesPayload,
  createSessionSnapshot,
  restoreSessionSnapshot,
  restoreSplitSession,
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

describe("split session storage", () => {
  const workspace = updateActiveContent(createInitialWorkspace(), "# Draft");
  const prefs = {
    readingPositions: {
      "/tmp/a.md": {
        cursorEnd: 3,
        cursorStart: 1,
        previewScrollTop: 100,
        textareaScrollTop: 50,
        viewMode: "preview" as const,
        savedAt: 42
      }
    },
    readingSettings: {
      autoSave: true,
      defaultViewMode: "read" as const,
      fontSize: 18,
      lineHeight: 1.8,
      readingWidth: 900
    },
    themeMode: "dark" as const,
    viewMode: "preview" as const
  };

  it("round-trips documents and preferences payloads", () => {
    const restored = restoreSplitSession(
      createSessionDocumentsPayload(workspace),
      createSessionPreferencesPayload(prefs)
    );

    expect(restored?.version).toBe(2);
    expect(restored?.workspace).toEqual(workspace);
    expect(restored?.viewMode).toBe("preview");
    expect(restored?.themeMode).toBe("dark");
    expect(restored?.readingSettings.fontSize).toBe(18);
    expect(restored?.readingPositions["/tmp/a.md"]?.previewScrollTop).toBe(100);
  });

  it("restores documents with defaults when preferences are missing or broken", () => {
    const docsPayload = createSessionDocumentsPayload(workspace);

    const withoutPrefs = restoreSplitSession(docsPayload, null);
    expect(withoutPrefs?.viewMode).toBe("split");
    expect(withoutPrefs?.themeMode).toBe("system");
    expect(withoutPrefs?.readingSettings.autoSave).toBe(true);
    expect(withoutPrefs?.readingPositions).toEqual({});

    const withBrokenPrefs = restoreSplitSession(docsPayload, "not json");
    expect(withBrokenPrefs?.workspace).toEqual(workspace);
    expect(withBrokenPrefs?.readingSettings.defaultViewMode).toBe("split");

    const withInvalidFields = restoreSplitSession(
      docsPayload,
      JSON.stringify({ version: 2, viewMode: "bogus", themeMode: 7, readingSettings: { fontSize: 999 } })
    );
    expect(withInvalidFields?.viewMode).toBe("split");
    expect(withInvalidFields?.themeMode).toBe("system");
    // Out-of-range numbers are clamped, not discarded.
    expect(withInvalidFields?.readingSettings.fontSize).toBe(22);
  });

  it("returns null for missing, invalid, or inconsistent document payloads", () => {
    expect(restoreSplitSession(null, null)).toBeNull();
    expect(restoreSplitSession("not json", null)).toBeNull();
    expect(restoreSplitSession(JSON.stringify({ version: 1, workspace }), null)).toBeNull();
    expect(
      restoreSplitSession(
        JSON.stringify({
          version: 2,
          workspace: { documents: [workspace.documents[0]], activeDocumentId: "missing-id" }
        }),
        null
      )
    ).toBeNull();
  });

  it("still restores the legacy single-blob format for migration", () => {
    const legacy = restoreSessionSnapshot(
      JSON.stringify(createSessionSnapshot(workspace, "read", "light", undefined, {}))
    );
    expect(legacy?.viewMode).toBe("read");
    expect(legacy?.themeMode).toBe("light");
  });
});
