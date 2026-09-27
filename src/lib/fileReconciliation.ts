import type { MarkdownDocument, MarkdownWorkspace } from "./documentModel";
import type { OpenedMarkdownFile } from "../shared/types/document";
import type { PlainMarkApi } from "../shared/types/plainmarkApi";
import { getConflictCopyPath } from "./exportDocument";

// Persisted contents are only a cache. Even clean tabs must be checked again
// after restarting, before any automatic or manual write to their path.
export function prepareRestoredWorkspace(workspace: MarkdownWorkspace): MarkdownWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map((document) => document.path
      ? { ...document, diskState: "checking" }
      : document)
  };
}

export function flagExternalChange(workspace: MarkdownWorkspace, path: string): MarkdownWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map((document) => document.path !== path ? document : {
      ...document,
      diskState: document.isDirty || document.diskState === "conflict" ? "conflict" : "checking"
    })
  };
}

// Compare inside the state updater, not before awaiting I/O. A changed object
// means the user edited/saved the tab or a newer disk event superseded this read.
export function reconcileDiskRead(
  workspace: MarkdownWorkspace,
  expected: MarkdownDocument,
  file: OpenedMarkdownFile | null,
  discardExpectedEdits = false
): MarkdownWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map((document) => {
      if (document.id !== expected.id || document.path !== expected.path) return document;
      if (document !== expected) return document;
      if (!file || file.path !== expected.path) {
        return { ...document, isDirty: true, diskState: "conflict" };
      }
      if (document.content === file.content) {
        return { ...document, isDirty: false, diskState: undefined };
      }
      if (document.isDirty && !discardExpectedEdits) {
        return { ...document, diskState: "conflict" };
      }
      return { ...document, content: file.content, isDirty: false, diskState: undefined };
    })
  };
}

export function resolveLocalConflict(workspace: MarkdownWorkspace, expected: MarkdownDocument): MarkdownWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map((document) => document === expected
      ? { ...document, diskState: undefined }
      : document)
  };
}

export async function resolveDiskConflict({
  document, action, api, updateWorkspace, rememberRecentPaths, protectedPaths
}: {
  document: MarkdownDocument;
  action: "save-copy" | "reload";
  api: PlainMarkApi;
  updateWorkspace(update: (workspace: MarkdownWorkspace) => MarkdownWorkspace): void;
  rememberRecentPaths(paths: string[]): void;
  protectedPaths: string[];
}): Promise<"canceled" | "checked"> {
  if (!document.path) return "canceled";
  if (action === "save-copy") {
    const copy = await api.saveMarkdownAs({
      path: getConflictCopyPath(document.path),
      content: document.content,
      excludedPaths: [...new Set([...protectedPaths, document.path])]
    });
    if (!copy) return "canceled";
    rememberRecentPaths([copy.path]);
  }
  // Leave the conflict (and write lock) intact until both operations succeed.
  const file = await api.readFile(document.path);
  updateWorkspace((current) => reconcileDiskRead(current, document, file, true));
  return "checked";
}
