import { useCallback, useRef } from "react";
import {
  collectSourceAnchors,
  findPreviewScrollTop,
  findPreviewScrollTopForSourceLine,
  findSourceLineForTextareaOffsets,
  findSourceLineForPreviewScrollTop,
  findTextareaScrollTop,
  findTextareaScrollTopForSourceLineOffsets
} from "../lib/scrollSync";
import type { PersistedViewMode } from "../lib/session";
import {
  getTextareaLineOffsets,
  type TextareaLineLayout
} from "../lib/textareaLayout";

function getLineCount(source: string): number {
  return source.split("\n").length;
}

function setScrollTopIfMeaningful(element: HTMLElement, targetScrollTop: number): void {
  if (Math.abs(element.scrollTop - targetScrollTop) > 1) {
    element.scrollTop = targetScrollTop;
  }
}

export function useScrollSyncController(viewMode: PersistedViewMode) {
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSyncingRef = useRef(false);
  const textareaLineLayoutRef = useRef<TextareaLineLayout | null>(null);

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
      const sourceLine = findSourceLineForTextareaOffsets(
        textarea.scrollTop,
        getTextareaLineOffsets(textarea, textareaLineLayoutRef)
      );
      const anchoredScrollTop = findPreviewScrollTopForSourceLine(
        sourceLine,
        collectSourceAnchors(preview),
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
  }, [releaseScrollSyncLock, viewMode]);

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
      const sourceLine = findSourceLineForPreviewScrollTop(
        preview.scrollTop,
        collectSourceAnchors(preview),
        Math.max(0, getLineCount(textarea.value) - 1)
      );
      const anchoredScrollTop = sourceLine === null
        ? null
        : findTextareaScrollTopForSourceLineOffsets(
          sourceLine,
          getTextareaLineOffsets(textarea, textareaLineLayoutRef),
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
  }, [releaseScrollSyncLock, viewMode]);

  return {
    handlePreviewScroll,
    handleTextareaScroll,
    previewScrollRef,
    scrollToHeading,
    textareaRef
  };
}
