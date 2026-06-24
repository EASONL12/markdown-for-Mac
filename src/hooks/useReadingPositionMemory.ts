import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { MarkdownDocument } from "../lib/documentModel";
import {
  getDocumentPositionKey,
  updateReadingPosition,
  type ReadingPositions
} from "../lib/readingPosition";
import type { PersistedViewMode } from "../lib/session";

interface UseReadingPositionMemoryOptions {
  activeDocument: MarkdownDocument;
  previewScrollRef: RefObject<HTMLDivElement | null>;
  readingPositions: ReadingPositions;
  setReadingPositions: Dispatch<SetStateAction<ReadingPositions>>;
  setViewMode: Dispatch<SetStateAction<PersistedViewMode>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  viewMode: PersistedViewMode;
}

export function useReadingPositionMemory({
  activeDocument,
  previewScrollRef,
  readingPositions,
  setReadingPositions,
  setViewMode,
  textareaRef,
  viewMode
}: UseReadingPositionMemoryOptions) {
  const activeKey = getDocumentPositionKey(activeDocument);
  const restoredKeyRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const saveCurrentPosition = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const textarea = textareaRef.current;
      const preview = previewScrollRef.current;
      setReadingPositions((current) => updateReadingPosition(current, activeKey, {
        cursorEnd: textarea?.selectionEnd ?? 0,
        cursorStart: textarea?.selectionStart ?? 0,
        previewScrollTop: preview?.scrollTop ?? 0,
        textareaScrollTop: textarea?.scrollTop ?? 0,
        viewMode
      }));
    }, 120);
  }, [activeKey, previewScrollRef, setReadingPositions, textareaRef, viewMode]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (restoredKeyRef.current === activeKey) {
      return;
    }

    const position = readingPositions[activeKey];
    restoredKeyRef.current = activeKey;
    if (!position) {
      return;
    }

    setViewMode(position.viewMode);
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      const preview = previewScrollRef.current;
      if (textarea) {
        textarea.scrollTop = position.textareaScrollTop;
        textarea.setSelectionRange(position.cursorStart, position.cursorEnd);
      }
      if (preview) {
        preview.scrollTop = position.previewScrollTop;
      }
    });
  }, [activeKey, previewScrollRef, readingPositions, setViewMode, textareaRef]);

  useEffect(() => {
    saveCurrentPosition();
  }, [saveCurrentPosition, viewMode]);

  return {
    saveCurrentPosition
  };
}

