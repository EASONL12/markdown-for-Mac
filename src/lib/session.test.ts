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

    const snapshot = createSessionSnapshot(workspace, "preview", "dark");

    expect(snapshot).toEqual({
      version: 1,
      workspace,
      viewMode: "preview",
      themeMode: "dark"
    });
  });

  it("restores a valid snapshot and preserves dirty document state", () => {
    const workspace = updateActiveContent(createInitialWorkspace(), "# Draft");
    const snapshot: PlainMarkSessionSnapshot = {
      version: 1,
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
  });

  it("ignores invalid stored session data", () => {
    expect(restoreSessionSnapshot("not json")).toBeNull();
    expect(restoreSessionSnapshot(JSON.stringify({ version: 2 }))).toBeNull();
    expect(restoreSessionSnapshot(JSON.stringify({ version: 1, workspace: { documents: [] } }))).toBeNull();
  });
});
