import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { markActiveSaved, type MarkdownWorkspace } from "../lib/documentModel";
import {
  getConflictCopyPath,
  shouldAutoSaveDocument,
  type ConflictAction
} from "../lib/exportDocument";
import type { PlainMarkApi } from "../shared/types/plainmarkApi";

interface UseFileConflictControllerOptions {
  activeDocument: {
    content: string;
    isDirty: boolean;
    path: string | null;
  };
  api: PlainMarkApi;
  rememberRecentPaths(paths: string[]): void;
  setStatus: Dispatch<SetStateAction<string>>;
  setWorkspace: Dispatch<SetStateAction<MarkdownWorkspace>>;
  workspace: MarkdownWorkspace;
}

export function useFileConflictController({
  activeDocument,
  api,
  rememberRecentPaths,
  setStatus,
  setWorkspace,
  workspace
}: UseFileConflictControllerOptions) {
  const [pendingConflictPath, setPendingConflictPath] = useState<string | null>(null);

  useEffect(() => {
    const path = activeDocument.path;
    if (!shouldAutoSaveDocument(path, activeDocument.isDirty, pendingConflictPath)) return;

    const timer = setTimeout(async () => {
      const result = await api.saveMarkdown({ path, content: activeDocument.content });
      if (result) {
        setWorkspace((current) => markActiveSaved(current, result.path));
        setStatus("Auto-saved");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeDocument.content, activeDocument.path, activeDocument.isDirty, api, pendingConflictPath, setStatus, setWorkspace]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (workspace.documents.some((document) => document.isDirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [workspace.documents]);

  useEffect(() => {
    const paths = workspace.documents.filter((document) => document.path).map((document) => document.path as string);
    const uniquePaths = [...new Set(paths)];

    for (const path of uniquePaths) {
      api.watchFile(path);
    }

    return () => {
      for (const path of uniquePaths) {
        api.unwatchFile(path);
      }
    };
  }, [workspace.documents, api]);

  const reloadDocumentFromDisk = useCallback(async (filePath: string) => {
    const file = await api.readFile(filePath);
    if (file) {
      setWorkspace((current) => {
        const updated = current.documents.map((document) =>
          document.path === filePath ? { ...document, content: file.content, isDirty: false } : document
        );
        return { ...current, documents: updated };
      });
      setStatus(`Reloaded ${filePath}`);
    }
  }, [api, setStatus, setWorkspace]);

  useEffect(() => {
    const removeFileModified = api.onFileModified(async (filePath: string) => {
      const doc = workspace.documents.find((document) => document.path === filePath);
      if (!doc) return;

      if (doc.isDirty) {
        setPendingConflictPath(filePath);
        return;
      }

      await reloadDocumentFromDisk(filePath);
    });

    return () => { removeFileModified(); };
  }, [workspace.documents, api, reloadDocumentFromDisk]);

  const handleConflictAction = useCallback(async (action: ConflictAction) => {
    if (!pendingConflictPath) return;

    const filePath = pendingConflictPath;
    const doc = workspace.documents.find((document) => document.path === filePath);
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
  }, [api, pendingConflictPath, reloadDocumentFromDisk, rememberRecentPaths, setStatus, workspace.documents]);

  return {
    handleConflictAction,
    pendingConflictPath
  };
}

