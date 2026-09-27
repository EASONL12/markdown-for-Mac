import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { markDocumentSaved, type MarkdownDocument, type MarkdownWorkspace } from "../lib/documentModel";
import type { ConflictAction } from "../lib/exportDocument";
import { flagExternalChange, reconcileDiskRead, resolveLocalConflict, resolveDiskConflict } from "../lib/fileReconciliation";
import type { PlainMarkApi } from "../shared/types/plainmarkApi";

interface UseFileConflictControllerOptions {
  activeDocument: MarkdownDocument;
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
  const pendingConflictPath = workspace.documents.find((document) => document.diskState === "conflict")?.path ?? null;
  const [conflictBusy, setConflictBusy] = useState(false);
  const conflictBusyRef = useRef(false);
  const documentsRef = useRef(workspace.documents);
  documentsRef.current = workspace.documents;

  useEffect(() => {
    const path = activeDocument.path;
    if (!autoSaveEnabled) return;
    if (!path || !activeDocument.isDirty || activeDocument.diskState) return;

    const documentId = activeDocument.id;
    const timer = setTimeout(async () => {
      const current = documentsRef.current.find((document) => document.id === documentId);
      if (!current || current.diskState || current.content !== activeDocument.content) return;
      try {
        const result = await api.saveMarkdown({ path, content: activeDocument.content });
        if (result) {
          setWorkspace((workspaceState) => markDocumentSaved(workspaceState, documentId, result.path, result.content));
          setStatus("Auto-saved");
        }
      } catch {
        setStatus(`Could not save ${path}`);
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
    activeDocument.diskState,
    setStatus,
    setWorkspace
  ]);

  // Report dirty state to the main process so closing the window can warn
  // about unsaved edits instead of silently refusing to close.
  const hasDirtyDocuments = workspace.documents.some((document) => document.isDirty);
  useEffect(() => {
    api.setDirtyState(hasDirtyDocuments);
  }, [api, hasDirtyDocuments]);

  useEffect(() => {
    // Electron confirms close/reload in the main process. Browser preview has
    // no main process, so retain native navigation protection there.
    if (window.plainmark || !hasDirtyDocuments) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDirtyDocuments]);

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

  useEffect(() => {
    let canceled = false;
    for (const document of workspace.documents) {
      if (!document.path || document.diskState !== "checking") continue;
      const expected = document;
      api.readFile(document.path)
        .catch(() => null)
        .then((file) => {
          if (canceled) return;
          setWorkspace((current) => reconcileDiskRead(current, expected, file));
          if (!file) setStatus(`Could not read ${expected.path}; local contents preserved`);
        });
    }
    // Ignore reads from a previous workspace render, including StrictMode's
    // first mount. The next effect checks the latest document snapshot.
    return () => { canceled = true; };
  }, [api, setStatus, setWorkspace, workspace.documents]);

  useEffect(() => {
    return api.onFileModified((filePath: string) => {
      setWorkspace((current) => flagExternalChange(current, filePath));
    });
  }, [api, setWorkspace]);

  const handleConflictAction = useCallback(async (action: ConflictAction) => {
    if (!pendingConflictPath || conflictBusyRef.current) return;
    const doc = documentsRef.current.find((document) => document.path === pendingConflictPath);
    if (!doc) return;

    if (action === "keep-local" || action === "dismiss") {
      setWorkspace((current) => resolveLocalConflict(current, doc));
      setStatus(action === "keep-local" ? "Kept local edits" : "Dismissed external change");
      return;
    }

    conflictBusyRef.current = true;
    setConflictBusy(true);
    try {
      const outcome = await resolveDiskConflict({
        document: doc,
        action,
        api,
        updateWorkspace: setWorkspace,
        rememberRecentPaths,
        protectedPaths: documentsRef.current.flatMap((document) => document.path ? [document.path] : [])
      });
      setStatus(outcome === "canceled" ? "Save copy canceled; conflict still pending" : "Disk version checked");
    } catch {
      setStatus(`Could not resolve ${pendingConflictPath}; local contents preserved`);
    } finally {
      conflictBusyRef.current = false;
      setConflictBusy(false);
    }
  }, [api, pendingConflictPath, rememberRecentPaths, setStatus, setWorkspace]);

  return {
    conflictBusy,
    handleConflictAction,
    pendingConflictPath
  };
}
