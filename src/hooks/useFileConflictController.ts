import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { markDocumentSaved, type MarkdownWorkspace } from "../lib/documentModel";
import {
  getConflictCopyPath,
  shouldAutoSaveDocument,
  type ConflictAction
} from "../lib/exportDocument";
import type { PlainMarkApi } from "../shared/types/plainmarkApi";

interface UseFileConflictControllerOptions {
  activeDocument: {
    id: string;
    content: string;
    isDirty: boolean;
    path: string | null;
  };
  api: PlainMarkApi;
  autoSaveEnabled: boolean;
  rememberRecentPaths(paths: string[]): void;
  setStatus: Dispatch<SetStateAction<string>>;
  setWorkspace: Dispatch<SetStateAction<MarkdownWorkspace>>;
  workspace: MarkdownWorkspace;
}

export function useFileConflictController({
  activeDocument,
  api,
  autoSaveEnabled,
  rememberRecentPaths,
  setStatus,
  setWorkspace,
  workspace
}: UseFileConflictControllerOptions) {
  const [pendingConflictPath, setPendingConflictPath] = useState<string | null>(null);
  const documentsRef = useRef(workspace.documents);
  documentsRef.current = workspace.documents;

  useEffect(() => {
    const path = activeDocument.path;
    if (!autoSaveEnabled) return;
    if (!shouldAutoSaveDocument(path, activeDocument.isDirty, pendingConflictPath)) return;

    const documentId = activeDocument.id;
    const timer = setTimeout(async () => {
      const result = await api.saveMarkdown({ path, content: activeDocument.content });
      if (result) {
        setWorkspace((current) => markDocumentSaved(current, documentId, result.path, result.content));
        setStatus("Auto-saved");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    activeDocument.content,
    activeDocument.id,
    activeDocument.path,
    activeDocument.isDirty,
    api,
    autoSaveEnabled,
    pendingConflictPath,
    setStatus,
    setWorkspace
  ]);

  // Report dirty state to the main process so closing the window can warn
  // about unsaved edits instead of silently refusing to close.
  useEffect(() => {
    api.setDirtyState(workspace.documents.some((document) => document.isDirty));
  }, [api, workspace.documents]);

  // Register watchers only when the set of open paths changes, not on every keystroke.
  const watchedPathsKey = useMemo(
    () => [...new Set(workspace.documents.filter((document) => document.path).map((document) => document.path as string))]
      .sort()
      .join("\n"),
    [workspace.documents]
  );

  useEffect(() => {
    const paths = watchedPathsKey ? watchedPathsKey.split("\n") : [];

    for (const path of paths) {
      api.watchFile(path);
    }

    return () => {
      for (const path of paths) {
        api.unwatchFile(path);
      }
    };
  }, [api, watchedPathsKey]);

  const reloadDocumentFromDisk = useCallback(async (filePath: string) => {
    const file = await api.readFile(filePath);
    if (!file) return;

    const current = documentsRef.current.find((document) => document.path === filePath);
    if (!current || current.content === file.content) {
      return;
    }

    setWorkspace((workspaceState) => {
      const updated = workspaceState.documents.map((document) =>
        document.path === filePath ? { ...document, content: file.content, isDirty: false } : document
      );
      return { ...workspaceState, documents: updated };
    });
    setStatus(`Reloaded ${filePath}`);
  }, [api, setStatus, setWorkspace]);

  useEffect(() => {
    const removeFileModified = api.onFileModified(async (filePath: string) => {
      const doc = documentsRef.current.find((document) => document.path === filePath);
      if (!doc) return;

      if (doc.isDirty) {
        setPendingConflictPath(filePath);
        return;
      }

      await reloadDocumentFromDisk(filePath);
    });

    return () => { removeFileModified(); };
  }, [api, reloadDocumentFromDisk]);

  const handleConflictAction = useCallback(async (action: ConflictAction) => {
    if (!pendingConflictPath) return;

    const filePath = pendingConflictPath;
    const doc = documentsRef.current.find((document) => document.path === filePath);
    setPendingConflictPath(null);

    if (action === "keep-local" || action === "dismiss" || !doc) {
      setStatus(action === "keep-local" ? "Kept local edits" : "Dismissed external change");
      return;
    }

    if (action === "save-copy") {
      const savedCopy = await api.saveMarkdownAs({
        path: getConflictCopyPath(filePath),
        content: doc.content
      });
      if (!savedCopy) {
        setStatus("Save copy canceled");
        return;
      }
      rememberRecentPaths([savedCopy.path]);
    }

    await reloadDocumentFromDisk(filePath);
  }, [api, pendingConflictPath, reloadDocumentFromDisk, rememberRecentPaths, setStatus]);

  return {
    handleConflictAction,
    pendingConflictPath
  };
}
