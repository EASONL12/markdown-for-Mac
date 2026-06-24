import type { PlainMarkApi } from "../global";

const noopUnsubscribe = () => undefined;

export function createBrowserPreviewApi(): PlainMarkApi {
  return {
    openMarkdown: async () => null,
    saveMarkdown: async () => null,
    saveMarkdownAs: async () => null,
    exportHtml: async () => null,
    exportPdf: async () => null,
    onExternalFileOpen: () => noopUnsubscribe,
    onMenuOpen: () => noopUnsubscribe,
    onMenuOpenRecent: () => noopUnsubscribe,
    onMenuNew: () => noopUnsubscribe,
    onMenuClose: () => noopUnsubscribe,
    onMenuSave: () => noopUnsubscribe,
    onMenuSaveAs: () => noopUnsubscribe,
    onMenuExportHtml: () => noopUnsubscribe,
    onMenuExportPdf: () => noopUnsubscribe,
    setTheme: async () => undefined,
    getTheme: async () => "light",
    onMenuToggleDark: () => noopUnsubscribe,
    onMenuFind: () => noopUnsubscribe,
    onMenuReplace: () => noopUnsubscribe,
    watchFile: async () => undefined,
    unwatchFile: async () => undefined,
    onFileModified: () => noopUnsubscribe,
    readFile: async () => null,
    getVersion: async () => "0.0.0"
  };
}

export function getPlainMarkApi(): PlainMarkApi {
  return window.plainmark ?? createBrowserPreviewApi();
}
