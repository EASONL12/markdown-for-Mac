import { describe, expect, it } from "vitest";
import {
  addOrActivateDocument,
  createInitialDocument,
  createInitialWorkspace,
  getActiveDocument,
  getDisplayName,
  markDocumentSaved,
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
    const saved = markDocumentSaved(
      edited,
      selected.activeDocumentId,
      "/Users/easonlin/Desktop/first.md",
      "# First\n\nEdited"
    );

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

    const saved = markDocumentSaved(
      workspace,
      workspace.activeDocumentId,
      "/Users/easonlin/Desktop/first.md",
      "# Second"
    );

    expect(saved.documents).toHaveLength(1);
    expect(saved.activeDocumentId).toBe("/Users/easonlin/Desktop/first.md");
    expect(getActiveDocument(saved).content).toBe("# Second");
  });

  it("keeps a document dirty when it changes while a save is in flight", () => {
    const workspace = updateActiveContent(createInitialWorkspace(), "# Submitted");
    const editedAgain = updateActiveContent(workspace, "# Newer edit");

    const saved = markDocumentSaved(editedAgain, "untitled", "/tmp/notes.md", "# Submitted");

    expect(getActiveDocument(saved).path).toBe("/tmp/notes.md");
    expect(getActiveDocument(saved).content).toBe("# Newer edit");
    expect(getActiveDocument(saved).isDirty).toBe(true);
  });
});

describe("save-as draft protection", () => {
  function twoDocuments() {
    return {
      activeDocumentId: "/a.md",
      documents: [
        { id: "/a.md", path: "/a.md", content: "A", isDirty: true },
        { id: "/b.md", path: "/b.md", content: "unsaved B", isDirty: true }
      ]
    };
  }

  it("retains a dirty destination tab as an unsaved recovery draft", () => {
    const saved = markDocumentSaved(twoDocuments(), "/a.md", "/b.md", "A");
    expect(saved.documents).toHaveLength(2);
    expect(getActiveDocument(saved)).toMatchObject({ path: "/b.md", content: "A", isDirty: false });
    const recovered = saved.documents.find((doc) => doc.path === null)!;
    expect(recovered).toMatchObject({ content: "unsaved B", isDirty: true, recoveredFrom: "/b.md", diskState: undefined });
    expect(getDisplayName(recovered)).toBe("b.md (recovered) *");
    expect(new Set(saved.documents.map((doc) => doc.id)).size).toBe(2);
  });

  it("keeps focus on destination edits made while the save dialog was open", () => {
    const state = { ...twoDocuments(), activeDocumentId: "/b.md" };
    const saved = markDocumentSaved(state, "/a.md", "/b.md", "A");
    expect(getActiveDocument(saved)).toMatchObject({ path: null, content: "unsaved B", isDirty: true });
  });

  it("does not leave a dangling selection when merging a clean destination tab", () => {
    const state = { ...twoDocuments(), activeDocumentId: "/b.md" };
    state.documents[1].isDirty = false;
    const saved = markDocumentSaved(state, "/a.md", "/b.md", "A");
    expect(saved.documents.some((doc) => doc.id === saved.activeDocumentId)).toBe(true);
    expect(getActiveDocument(saved).content).toBe("A");
  });

  it("does not unlock a new conflict when an earlier save completes", () => {
    const state = twoDocuments();
    const conflicting = { ...state, documents: state.documents.map((doc) => ({ ...doc, diskState: "conflict" as const })) };
    const saved = markDocumentSaved(conflicting, "/a.md", "/a.md", "A");
    expect(getActiveDocument(saved)).toMatchObject({ isDirty: true, diskState: "conflict" });
  });
});
