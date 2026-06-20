import type { PlainMarkApi } from "../global";

const noopUnsubscribe = () => undefined;

export function createBrowserPreviewApi(): PlainMarkApi {
  return {
    openMarkdown: async () => null,
    saveMarkdown: async () => null,
    onExternalFileOpen: () => noopUnsubscribe,
    onMenuOpen: () => noopUnsubscribe,
    onMenuSave: () => noopUnsubscribe
  };
}

export function getPlainMarkApi(): PlainMarkApi {
  return window.plainmark ?? createBrowserPreviewApi();
}
