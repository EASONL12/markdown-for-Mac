import { useCallback, useEffect, useRef } from "react";
import {
  collectSourceAnchors,
  findPreviewScrollTop,
  findPreviewScrollTopForSourceLine,
  findSourceLineForTextareaOffsets,
  findSourceLineForPreviewScrollTop,
  findTextareaScrollTop,
  findTextareaScrollTopForSourceLineOffsets,
  type SourceScrollAnchor
} from "../lib/scrollSync";
import type { PersistedViewMode } from "../lib/session";
import {
  getTextareaLineOffsets,
  type TextareaLineLayout
} from "../lib/textareaLayout";

function setScrollTopIfMeaningful(element: HTMLElement, targetScrollTop: number): void {
  if (Math.abs(element.scrollTop - targetScrollTop) > 1) {
    element.scrollTop = targetScrollTop;
  }
}

interface AnchorCacheEntry {
  key: string;
  anchors: SourceScrollAnchor[];
}

export function useScrollSyncController(viewMode: PersistedViewMode, renderVersion: number) {
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSyncingRef = useRef(false);
  const textareaLineLayoutRef = useRef<TextareaLineLayout | null>(null);
  const anchorCacheRef = useRef<AnchorCacheEntry | null>(null);
  const anchorsInvalidRef = useRef(false);

  // Anchor positions depend on layout, not just HTML: images load after the
  // preview is written and shift heading offsets, and resizes/font loads do
  // too. Invalidate on all of them; the next scroll frame rebuilds.
  useEffect(() => {
    const container = previewScrollRef.current;
    if (!container) return;

    const invalidate = () => {
      anchorsInvalidRef.current = true;
    };
    container.addEventListener("load", invalidate, true);
    window.addEventListener("resize", invalidate);
    document.fonts?.ready.then(invalidate).catch(() => {});
    return () => {
      container.removeEventListener("load", invalidate, true);
      window.removeEventListener("resize", invalidate);
    };
  }, []);

  const getSortedAnchors = useCallback((preview: HTMLDivElement): SourceScrollAnchor[] => {
    const key = `${renderVersion}:${preview.clientWidth}`;
    const cached = anchorCacheRef.current;
    if (!anchorsInvalidRef.current && cached && cached.key === key) {
      return cached.anchors;
    }

    const anchors = collectSourceAnchors(preview);
    anchors.sort((a, b) => a.line - b.line || a.scrollTop - b.scrollTop);
    anchorCacheRef.current = { key, anchors };
    anchorsInvalidRef.current = false;
    return anchors;
  }, [renderVersion]);

  const scrollToHeading = useCallback((headingId: string) => {
    const container = previewScrollRef.current;
    if (!container) {
      return;
    }

    const target = Array.from(container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")).find(
      (heading) => heading.id === headingId
    );
    if (!target) {
      return;
    }

    container.scrollTo({
      top: target.offsetTop - container.offsetTop,
      behavior: "smooth"
    });
  }, []);

  const releaseScrollSyncLock = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    });
  }, []);

  const handleTextareaScroll = useCallback(() => {
    if (isSyncingRef.current || viewMode !== "split") return;
    isSyncingRef.current = true;

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      const preview = previewScrollRef.current;
      if (!textarea || !preview) {
        isSyncingRef.current = false;
        return;
      }

      const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight);
      const offsets = getTextareaLineOffsets(textarea, textareaLineLayoutRef);
      const sourceLine = findSourceLineForTextareaOffsets(textarea.scrollTop, offsets);
      const anchoredScrollTop = findPreviewScrollTopForSourceLine(
        sourceLine,
        getSortedAnchors(preview),
        previewMax
      );
      const targetScroll = anchoredScrollTop ?? findPreviewScrollTop(
        textarea.scrollTop,
        textarea.scrollHeight,
        textarea.clientHeight,
        preview.scrollHeight,
        preview.clientHeight
      );
      setScrollTopIfMeaningful(preview, targetScroll);
      releaseScrollSyncLock();
    });
  }, [getSortedAnchors, releaseScrollSyncLock, viewMode]);

  const handlePreviewScroll = useCallback(() => {
    if (isSyncingRef.current || viewMode !== "split") return;
    isSyncingRef.current = true;

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      const preview = previewScrollRef.current;
      if (!textarea || !preview) {
        isSyncingRef.current = false;
        return;
      }

      const textareaMax = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
      const offsets = getTextareaLineOffsets(textarea, textareaLineLayoutRef);
      // The mirror measurement holds one entry per source line.
      const maxSourceLine = Math.max(0, offsets.length - 1);
      const sourceLine = findSourceLineForPreviewScrollTop(
        preview.scrollTop,
        getSortedAnchors(preview),
        maxSourceLine
      );
      const anchoredScrollTop = sourceLine === null
        ? null
        : findTextareaScrollTopForSourceLineOffsets(
          sourceLine,
          offsets,
          textareaMax
        );
      const targetScroll = anchoredScrollTop ?? findTextareaScrollTop(
        preview.scrollTop,
        preview.scrollHeight,
        preview.clientHeight,
        textarea.scrollHeight,
        textarea.clientHeight
      );
      setScrollTopIfMeaningful(textarea, targetScroll);
      releaseScrollSyncLock();
    });
  }, [getSortedAnchors, releaseScrollSyncLock, viewMode]);

  return {
    handlePreviewScroll,
    handleTextareaScroll,
    previewScrollRef,
    scrollToHeading,
    textareaRef
  };
}
