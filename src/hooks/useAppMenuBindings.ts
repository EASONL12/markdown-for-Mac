import { useEffect } from "react";
import type { PlainMarkApi } from "../shared/types/plainmarkApi";

interface UseAppMenuBindingsOptions {
  api: PlainMarkApi;
  closeDocument(): void;
  exportDocument(format: "html" | "pdf"): void;
  newDocument(): void;
  onExternalFileOpen(file: { path: string; content: string }): void;
  openDocument(): void;
  openFind(): void;
  openRecentPanel(): void;
  openReplace(): void;
  saveDocument(): void;
  saveDocumentAs(): void;
}

export function useAppMenuBindings({
  api,
  closeDocument,
  exportDocument,
  newDocument,
  onExternalFileOpen,
  openDocument,
  openFind,
  openRecentPanel,
  openReplace,
  saveDocument,
  saveDocumentAs
}: UseAppMenuBindingsOptions) {
  useEffect(() => {
    const removeExternal = api.onExternalFileOpen(onExternalFileOpen);
    const removeOpen = api.onMenuOpen(openDocument);
    const removeOpenRecent = api.onMenuOpenRecent(openRecentPanel);
    const removeNew = api.onMenuNew(newDocument);
    const removeClose = api.onMenuClose(closeDocument);
    const removeSave = api.onMenuSave(saveDocument);
    const removeSaveAs = api.onMenuSaveAs(saveDocumentAs);
    const removeExportHtml = api.onMenuExportHtml(() => exportDocument("html"));
    const removeExportPdf = api.onMenuExportPdf(() => exportDocument("pdf"));
    const removeFind = api.onMenuFind(openFind);
    const removeReplace = api.onMenuReplace(openReplace);

    return () => {
      removeExternal();
      removeOpen();
      removeOpenRecent();
      removeNew();
      removeClose();
      removeSave();
      removeSaveAs();
      removeExportHtml();
      removeExportPdf();
      removeFind();
      removeReplace();
    };
  }, [
    api,
    closeDocument,
    exportDocument,
    newDocument,
    onExternalFileOpen,
    openDocument,
    openFind,
    openRecentPanel,
    openReplace,
    saveDocument,
    saveDocumentAs
  ]);
}

