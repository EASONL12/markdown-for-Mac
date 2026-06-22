import type { PlainMarkApi } from "../global";

const noopUnsubscribe = () => undefined;

export function createBrowserPreviewApi(): PlainMarkApi {
  return {
    openMarkdown: async () => null,
    saveMarkdown: async () => null,
    onExternalFileOpen: () => noopUnsubscribe,
    onMenuOpen: () => noopUnsubscribe,
    onMenuNew: () => noopUnsubscribe,
    onMenuClose: () => noopUnsubscribe,
    onMenuSave: () => noopUnsubscribe,
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
