import { useCallback, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { resolveLocalAssetHref, resolveMarkdownHref } from "../lib/fileLinks";
import type { ImagePreviewState } from "../shared/types/ui";

interface UsePreviewInteractionsOptions {
  activeDocumentPath: string | null;
  onOpenLocalMarkdown(path: string, anchor: string | null): void;
  setImagePreview: Dispatch<SetStateAction<ImagePreviewState | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
}

function getClosestElement(target: EventTarget | null, selector: string): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(selector) : null;
}

export function usePreviewInteractions({
  activeDocumentPath,
  onOpenLocalMarkdown,
  setImagePreview,
  setStatus
}: UsePreviewInteractionsOptions) {
  return useCallback((event: MouseEvent<HTMLDivElement>) => {
    const copyButton = getClosestElement(event.target, "[data-code-copy]");
    if (copyButton) {
      event.preventDefault();
      const encodedCode = copyButton.dataset.codeCopy ?? "";
      const code = decodeURIComponent(encodedCode);
      navigator.clipboard.writeText(code)
        .then(() => setStatus("Copied code block"))
        .catch(() => setStatus("Could not copy code block"));
      return;
    }

    const image = getClosestElement(event.target, "img[data-preview-image]") as HTMLImageElement | null;
    if (image) {
      event.preventDefault();
      setImagePreview({
        alt: image.alt,
        src: resolveLocalAssetHref(activeDocumentPath, image.getAttribute("src") ?? image.src)
      });
      return;
    }

    const link = getClosestElement(event.target, "a[data-local-markdown-link]") as HTMLAnchorElement | null;
    if (!link) {
      return;
    }

    const resolved = resolveMarkdownHref(activeDocumentPath, link.getAttribute("href") ?? "");
    if (!resolved) {
      return;
    }

    event.preventDefault();
    onOpenLocalMarkdown(resolved.path, resolved.anchor);
  }, [activeDocumentPath, onOpenLocalMarkdown, setImagePreview, setStatus]);
}
