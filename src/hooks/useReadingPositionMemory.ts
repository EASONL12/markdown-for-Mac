import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { MarkdownDocument } from "../lib/documentModel";
import {
  getDocumentPositionKey,
  getDocumentViewMode,
  updateReadingPosition,
  type ReadingPositions
} from "../lib/readingPosition";
import type { PersistedViewMode } from "../lib/session";

interface UseReadingPositionMemoryOptions {
  activeDocument: MarkdownDocument;
  defaultViewMode: PersistedViewMode;
  previewScrollRef: RefObject<HTMLDivElement | null>;
  readingPositions: ReadingPositions;
  setReadingPositions: Dispatch<SetStateAction<ReadingPositions>>;
  setViewMode: Dispatch<SetStateAction<PersistedViewMode>>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  viewMode: PersistedViewMode;
}

export function useReadingPositionMemory({
  activeDocument,
  defaultViewMode,
  previewScrollRef,
  readingPositions,
  setReadingPositions,
  setViewMode,
  textareaRef,
  viewMode
}: UseReadingPositionMemoryOptions) {
  const activeKey = getDocumentPositionKey(activeDocument);
  const restoredKeyRef = useRef<string | null>(null);
  const saveTimersRef = useRef(new Map<string, number>());

  const savePosition = useCallback((positionViewMode: PersistedViewMode, immediate = false) => {
    const textarea = textareaRef.current;
    const preview = previewScrollRef.current;
    const position = {
      cursorEnd: textarea?.selectionEnd ?? 0,
      cursorStart: textarea?.selectionStart ?? 0,
      previewScrollTop: preview?.scrollTop ?? 0,
      textareaScrollTop: textarea?.scrollTop ?? 0,
      viewMode: positionViewMode
    };

    const existingTimer = saveTimersRef.current.get(activeKey);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }

    const persistPosition = () => {
      saveTimersRef.current.delete(activeKey);
      setReadingPositions((current) => updateReadingPosition(current, activeKey, position));
    };

    if (immediate) {
      persistPosition();
      return;
    }

    saveTimersRef.current.set(activeKey, window.setTimeout(persistPosition, 120));
  }, [activeKey, previewScrollRef, setReadingPositions, textareaRef]);

  const saveCurrentPosition = useCallback(() => {
    savePosition(viewMode);
  }, [savePosition, viewMode]);

  const changeViewMode = useCallback((nextViewMode: PersistedViewMode) => {
    setViewMode(nextViewMode);
    savePosition(nextViewMode, true);
  }, [savePosition, setViewMode]);

  useEffect(() => {
    return () => {
      for (const timer of saveTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      saveTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (restoredKeyRef.current === activeKey) {
      return;
    }

    const position = readingPositions[activeKey];
    restoredKeyRef.current = activeKey;
    setViewMode(getDocumentViewMode(readingPositions, activeKey, defaultViewMode));
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      const preview = previewScrollRef.current;
      if (textarea) {
        textarea.scrollTop = position?.textareaScrollTop ?? 0;
        textarea.setSelectionRange(position?.cursorStart ?? 0, position?.cursorEnd ?? 0);
      }
      if (preview) {
        preview.scrollTop = position?.previewScrollTop ?? 0;
      }
    });
  }, [activeKey, defaultViewMode, previewScrollRef, readingPositions, setViewMode, textareaRef]);

  return {
    changeViewMode,
    saveCurrentPosition
  };
}
