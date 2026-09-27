import { describe, expect, it, vi } from "vitest";
import { type MarkdownDocument, type MarkdownWorkspace, updateActiveContent } from "./documentModel";
import { flagExternalChange, prepareRestoredWorkspace, reconcileDiskRead, resolveDiskConflict, resolveLocalConflict } from "./fileReconciliation";
import { createBrowserPreviewApi } from "../platform/plainmarkApi";
import type { OpenedMarkdownFile } from "../shared/types/document";

function workspace(isDirty = false): MarkdownWorkspace {
  return { activeDocumentId: "/a.md", documents: [{ id: "/a.md", path: "/a.md", content: "cached", isDirty }] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("disk reconciliation", () => {
  it("checks restored clean files before allowing writes and loads offline changes", () => {
    const restored = prepareRestoredWorkspace(workspace());
    const before = restored.documents[0];
    expect(before.diskState).toBe("checking");
    const checked = reconcileDiskRead(restored, before, { path: "/a.md", content: "new disk version" });
    expect(checked.documents[0]).toMatchObject({ content: "new disk version", isDirty: false, diskState: undefined });
  });

  it("preserves restored dirty drafts and queues each differing file as a conflict", () => {
    let restored = prepareRestoredWorkspace({ ...workspace(true), documents: [
      ...workspace(true).documents,
      { id: "/b.md", path: "/b.md", content: "second draft", isDirty: true }
    ] });
    for (const document of [...restored.documents]) {
      restored = reconcileDiskRead(restored, document, { path: document.path!, content: "disk" });
    }
    expect(restored.documents.map((doc) => doc.diskState)).toEqual(["conflict", "conflict"]);
    expect(restored.documents.map((doc) => doc.content)).toEqual(["cached", "second draft"]);
    restored = resolveLocalConflict(restored, restored.documents[0]);
    expect(restored.documents[1].diskState).toBe("conflict");
  });

  it("clears stale dirty flags when cached contents match disk", () => {
    const restored = prepareRestoredWorkspace(workspace(true));
    expect(reconcileDiskRead(restored, restored.documents[0], { path: "/a.md", content: "cached" }).documents[0])
      .toMatchObject({ isDirty: false, diskState: undefined });
  });

  it("keeps missing/unreadable files recoverable and blocks automatic writes", () => {
    const restored = prepareRestoredWorkspace(workspace());
    expect(reconcileDiskRead(restored, restored.documents[0], null).documents[0])
      .toMatchObject({ content: "cached", isDirty: true, diskState: "conflict" });
  });

  it("leaves untitled drafts untouched during restoration", () => {
    const draft: MarkdownDocument = { id: "draft", path: null, content: "local", isDirty: true };
    expect(prepareRestoredWorkspace({ activeDocumentId: "draft", documents: [draft] }).documents[0]).toBe(draft);
  });

  it("does not overwrite typing queued while an external read is pending", () => {
    const reading = flagExternalChange(workspace(), "/a.md");
    const expected = reading.documents[0];
    const edited = updateActiveContent(reading, "new local input");
    const afterStaleRead = reconcileDiskRead(edited, expected, { path: "/a.md", content: "external" });
    expect(afterStaleRead.documents[0]).toBe(edited.documents[0]);
    const checkedAgain = reconcileDiskRead(afterStaleRead, afterStaleRead.documents[0], { path: "/a.md", content: "external" });
    expect(checkedAgain.documents[0]).toMatchObject({ content: "new local input", isDirty: true, diskState: "conflict" });
  });

  it("ignores a read superseded by a newer disk notification", () => {
    const first = flagExternalChange(workspace(), "/a.md");
    const second = flagExternalChange(first, "/a.md");
    expect(reconcileDiskRead(second, first.documents[0], { path: "/a.md", content: "stale" }).documents[0])
      .toBe(second.documents[0]);
  });

  it("does not resurrect closed documents", () => {
    const original = workspace();
    const empty = { documents: [], activeDocumentId: "" };
    expect(reconcileDiskRead(empty, original.documents[0], { path: "/a.md", content: "disk" }).documents).toEqual([]);
  });
});

describe("asynchronous conflict resolution", () => {
  function harness() {
    let current = flagExternalChange(workspace(true), "/a.md");
    const api = createBrowserPreviewApi();
    const rememberRecentPaths = vi.fn();
    const updateWorkspace = (update: (state: MarkdownWorkspace) => MarkdownWorkspace) => { current = update(current); };
    const run = (action: "save-copy" | "reload" = "save-copy") => resolveDiskConflict({
      document: current.documents[0], action, api, updateWorkspace, rememberRecentPaths, protectedPaths: ["/a.md", "/b.md"]
    });
    return { api, run, updateWorkspace, rememberRecentPaths, current: () => current };
  }

  it("keeps the write lock throughout a slow save dialog and disk reload", async () => {
    const h = harness();
    const copy = deferred<OpenedMarkdownFile | null>();
    const read = deferred<OpenedMarkdownFile | null>();
    h.api.saveMarkdownAs = vi.fn(() => copy.promise);
    h.api.readFile = vi.fn(() => read.promise);
    const resolving = h.run();
    expect(h.current().documents[0].diskState).toBe("conflict");
    expect(h.api.saveMarkdownAs).toHaveBeenCalledWith({ path: "/a.local-copy.md", content: "cached", excludedPaths: ["/a.md", "/b.md"] });
    copy.resolve({ path: "/copy.md", content: "cached" });
    await Promise.resolve();
    expect(h.current().documents[0].diskState).toBe("conflict");
    read.resolve({ path: "/a.md", content: "external" });
    await resolving;
    expect(h.current().documents[0]).toMatchObject({ content: "external", isDirty: false, diskState: undefined });
    expect(h.rememberRecentPaths).toHaveBeenCalledWith(["/copy.md"]);
  });

  it("keeps conflicts pending when saving a copy is canceled", async () => {
    const h = harness();
    h.api.readFile = vi.fn();
    expect(await h.run()).toBe("canceled");
    expect(h.api.readFile).not.toHaveBeenCalled();
    expect(h.current().documents[0]).toMatchObject({ content: "cached", isDirty: true, diskState: "conflict" });
  });

  it.each(["copy", "read"])("preserves the draft and lock if %s fails", async (stage) => {
    const h = harness();
    h.api.saveMarkdownAs = async () => {
      if (stage === "copy") throw new Error("write failed");
      return { path: "/copy.md", content: "cached" };
    };
    h.api.readFile = async () => { throw new Error("read failed"); };
    await expect(h.run()).rejects.toThrow();
    expect(h.current().documents[0]).toMatchObject({ content: "cached", isDirty: true, diskState: "conflict" });
  });

  it.each(["save-copy", "reload"] as const)("preserves edits made while %s is pending", async (action) => {
    const h = harness();
    const read = deferred<OpenedMarkdownFile | null>();
    h.api.saveMarkdownAs = async () => ({ path: "/copy.md", content: "cached" });
    h.api.readFile = () => read.promise;
    const resolving = h.run(action);
    h.updateWorkspace((current) => updateActiveContent(current, "typed during I/O"));
    read.resolve({ path: "/a.md", content: "disk" });
    await resolving;
    expect(h.current().documents[0]).toMatchObject({ content: "typed during I/O", isDirty: true, diskState: "conflict" });
  });
});
