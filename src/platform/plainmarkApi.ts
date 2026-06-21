import type { PlainMarkApi } from "../global";

const noopUnsubscribe = () => undefined;

export function createBrowserPreviewApi(): PlainMarkApi {
  return {
    openMarkdown: async () => null,
    saveMarkdown: async () => null,
    onExternalFileOpen: () => noopUnsubscribe,
    onMenuOpen: () => noopUnsubscribe,
    onMenuSave: () => noopUnsubscribe,
    setTheme: async () => undefined,
    getTheme: async () => "light",
    onMenuToggleDark: () => noopUnsubscribe,
    onMenuFind: () => noopUnsubscribe,
    onMenuReplace: () => noopUnsubscribe
  };
}

export function getPlainMarkApi(): PlainMarkApi {
  return window.plainmark ?? createBrowserPreviewApi();
}
