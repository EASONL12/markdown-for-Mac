import { describe, expect, it } from "vitest";
import {
  addOrActivateDocument,
  createInitialDocument,
  createInitialWorkspace,
  getActiveDocument,
  getDisplayName,
  markActiveSaved,
  markSaved,
  selectDocument,
  updateActiveContent,
  updateContent
} from "./documentModel";

describe("documentModel", () => {
  it("creates an untitled editable document", () => {
    const doc = createInitialDocument();

    expect(doc.path).toBeNull();
    expect(doc.content).toContain("# Untitled");
    expect(doc.isDirty).toBe(false);
    expect(getDisplayName(doc)).toBe("Untitled.md");
  });

  it("tracks dirty state and display name for opened files", () => {
    const opened = {
      id: "/Users/easonlin/Documents/notes.md",
      path: "/Users/easonlin/Documents/notes.md",
      content: "# Notes",
      isDirty: false
    };

    const edited = updateContent(opened, "# Notes\n\nNew line");
    const saved = markSaved(edited, "/Users/easonlin/Documents/notes.md");

    expect(edited.isDirty).toBe(true);
    expect(getDisplayName(edited)).toBe("notes.md *");
    expect(saved.isDirty).toBe(false);
    expect(getDisplayName(saved)).toBe("notes.md");
  });

  it("adds opened files to a workspace and activates the newest file", () => {
    const workspace = createInitialWorkspace();
    const withFirst = addOrActivateDocument(workspace, {
      path: "/Users/easonlin/Desktop/first.md",
      content: "# First"
    });
    const withSecond = addOrActivateDocument(withFirst, {
      path: "/Users/easonlin/Desktop/second.md",
      content: "# Second"
    });

    expect(withSecond.documents).toHaveLength(2);
    expect(getActiveDocument(withSecond).path).toBe("/Users/easonlin/Desktop/second.md");
  });

  it("activates an already-open file instead of duplicating it", () => {
    const workspace = addOrActivateDocument(
      addOrActivateDocument(createInitialWorkspace(), {
        path: "/Users/easonlin/Desktop/first.md",
        content: "# First"
      }),
      {
        path: "/Users/easonlin/Desktop/second.md",
        content: "# Second"
      }
    );

    const reopened = addOrActivateDocument(workspace, {
      path: "/Users/easonlin/Desktop/first.md",
      content: "# First changed on disk"
    });

    expect(reopened.documents).toHaveLength(2);
    expect(getActiveDocument(reopened).path).toBe("/Users/easonlin/Desktop/first.md");
    expect(getActiveDocument(reopened).content).toBe("# First");
  });

  it("updates, saves, and selects only the active workspace document", () => {
    const workspace = addOrActivateDocument(
      addOrActivateDocument(createInitialWorkspace(), {
        path: "/Users/easonlin/Desktop/first.md",
        content: "# First"
      }),
      {
        path: "/Users/easonlin/Desktop/second.md",
        content: "# Second"
      }
    );

    const selected = selectDocument(workspace, "/Users/easonlin/Desktop/first.md");
    const edited = updateActiveContent(selected, "# First\n\nEdited");
    const saved = markActiveSaved(edited, "/Users/easonlin/Desktop/first.md");

    expect(getActiveDocument(edited).isDirty).toBe(true);
    expect(getActiveDocument(saved).isDirty).toBe(false);
    expect(saved.documents.find((document) => document.path === "/Users/easonlin/Desktop/second.md")?.content).toBe("# Second");
  });

  it("keeps a dirty untitled document when opening another file", () => {
    const dirtyWorkspace = updateActiveContent(createInitialWorkspace(), "# Draft");
    const workspace = addOrActivateDocument(dirtyWorkspace, {
      path: "/Users/easonlin/Desktop/first.md",
      content: "# First"
    });

    expect(workspace.documents).toHaveLength(2);
    expect(workspace.documents.find((document) => document.path === null)?.content).toBe("# Draft");
  });

  it("deduplicates documents when saving to a path that is already open", () => {
    const workspace = addOrActivateDocument(
      addOrActivateDocument(createInitialWorkspace(), {
        path: "/Users/easonlin/Desktop/first.md",
        content: "# First"
      }),
      {
        path: "/Users/easonlin/Desktop/second.md",
        content: "# Second"
      }
    );

    const saved = markActiveSaved(workspace, "/Users/easonlin/Desktop/first.md");

    expect(saved.documents).toHaveLength(1);
    expect(saved.activeDocumentId).toBe("/Users/easonlin/Desktop/first.md");
    expect(getActiveDocument(saved).content).toBe("# Second");
  });
});
