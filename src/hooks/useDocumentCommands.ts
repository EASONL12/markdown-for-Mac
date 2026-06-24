import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  addNewDocument,
  addOrActivateDocument,
  addOrActivateDocuments,
  markActiveSaved,
  removeDocument,
  selectDocument,
  type MarkdownDocument,
  type MarkdownWorkspace
} from "../lib/documentModel";
import {
  buildExportHtml,
  getDefaultExportPath,
  type ExportFormat
} from "../lib/exportDocument";
import type { PlainMarkApi } from "../shared/types/plainmarkApi";

interface UseDocumentCommandsOptions {
  activeDocument: MarkdownDocument;
  api: PlainMarkApi;
  isDark: boolean;
  recentInputRef: RefObject<HTMLInputElement | null>;
  rememberRecentPaths(paths: string[]): void;
  removeRecentPath(path: string): void;
  rendered: string;
  setRecentOpen: Dispatch<SetStateAction<boolean>>;
  setRecentSearch(query: string): void;
  setStatus: Dispatch<SetStateAction<string>>;
  setWorkspace: Dispatch<SetStateAction<MarkdownWorkspace>>;
  workspace: MarkdownWorkspace;
}

export function useDocumentCommands({
  activeDocument,
  api,
  isDark,
  recentInputRef,
  rememberRecentPaths,
  removeRecentPath,
  rendered,
  setRecentOpen,
  setRecentSearch,
  setStatus,
  setWorkspace,
  workspace
}: UseDocumentCommandsOptions) {
  const openDocument = useCallback(async () => {
    const files = await api.openMarkdown();
    if (!files || files.length === 0) {
      return;
    }

    setWorkspace((current) => addOrActivateDocuments(current, files));
    rememberRecentPaths(files.map((file) => file.path));
    setStatus(files.length === 1 ? `Opened ${files[0].path}` : `Opened ${files.length} files`);
  }, [api, rememberRecentPaths, setStatus, setWorkspace]);

  const saveDocument = useCallback(async () => {
    const file = await api.saveMarkdown({
      path: activeDocument.path,
      content: activeDocument.content
    });

    if (!file) {
      return;
    }

    setWorkspace((current) => markActiveSaved(current, file.path));
    rememberRecentPaths([file.path]);
    setStatus(`Saved ${file.path}`);
  }, [activeDocument.content, activeDocument.path, api, rememberRecentPaths, setStatus, setWorkspace]);

  const saveDocumentAs = useCallback(async () => {
    const file = await api.saveMarkdownAs({
      path: activeDocument.path,
      content: activeDocument.content
    });

    if (!file) {
      return;
    }

    setWorkspace((current) => markActiveSaved(current, file.path));
    rememberRecentPaths([file.path]);
    setStatus(`Saved as ${file.path}`);
  }, [activeDocument.content, activeDocument.path, api, rememberRecentPaths, setStatus, setWorkspace]);

  const exportDocument = useCallback(async (format: ExportFormat) => {
    const html = buildExportHtml({
      bodyHtml: rendered,
      sourcePath: activeDocument.path,
      theme: isDark ? "dark" : "light"
    });
    const defaultPath = getDefaultExportPath(activeDocument.path, format);
    const exportedPath = format === "html"
      ? await api.exportHtml({ defaultPath, html })
      : await api.exportPdf({ defaultPath, html });

    if (exportedPath) {
      setStatus(`Exported ${exportedPath}`);
    }
  }, [activeDocument.path, api, isDark, rendered, setStatus]);

  const openRecentPanel = useCallback(() => {
    setRecentOpen(true);
    setRecentSearch("");
    setTimeout(() => recentInputRef.current?.focus(), 50);
  }, [recentInputRef, setRecentOpen, setRecentSearch]);

  const openRecentDocument = useCallback(async (path: string) => {
    try {
      const file = await api.readFile(path);
      if (!file) {
        removeRecentPath(path);
        setStatus(`Could not open ${path}`);
        return;
      }

      setWorkspace((current) => addOrActivateDocument(current, file));
      rememberRecentPaths([file.path]);
      setRecentOpen(false);
      setStatus(`Opened ${file.path}`);
    } catch {
      removeRecentPath(path);
      setStatus(`Could not open ${path}`);
    }
  }, [api, rememberRecentPaths, removeRecentPath, setRecentOpen, setStatus, setWorkspace]);

  const newDocument = useCallback(() => {
    setWorkspace((current) => addNewDocument(current));
    setStatus("New document");
  }, [setStatus, setWorkspace]);

  const closeDocument = useCallback((documentId?: string) => {
    const doc = documentId
      ? workspace.documents.find((document) => document.id === documentId)
      : activeDocument;
    if (!doc) return;
    if (doc.isDirty) {
      const confirmed = window.confirm("This document has unsaved changes. Close anyway?");
      if (!confirmed) return;
    }
    if (doc.path) {
      api.unwatchFile(doc.path);
    }
    setWorkspace((current) => removeDocument(current, doc.id));
    setStatus("Closed");
  }, [activeDocument, api, setStatus, setWorkspace, workspace.documents]);

  const selectDocumentById = useCallback((document: MarkdownDocument) => {
    setWorkspace((current) => selectDocument(current, document.id));
    setStatus(document.path ? `Viewing ${document.path}` : "Viewing unsaved file");
  }, [setStatus, setWorkspace]);

  const openExternalFile = useCallback((file: { path: string; content: string }) => {
    setWorkspace((current) => addOrActivateDocument(current, file));
    rememberRecentPaths([file.path]);
    setStatus(`Opened ${file.path}`);
  }, [rememberRecentPaths, setStatus, setWorkspace]);

  const openDroppedFiles = useCallback((files: { path: string; content: string }[]) => {
    setWorkspace((current) => addOrActivateDocuments(current, files));
    rememberRecentPaths(files.map((file) => file.path));
    setStatus(files.length === 1 ? `Opened ${files[0].path}` : `Opened ${files.length} files`);
  }, [rememberRecentPaths, setStatus, setWorkspace]);

  return {
    closeDocument,
    exportDocument,
    newDocument,
    openDocument,
    openDroppedFiles,
    openExternalFile,
    openRecentDocument,
    openRecentPanel,
    saveDocument,
    saveDocumentAs,
    selectDocumentById
  };
}

