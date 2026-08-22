import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findAll, findNextMatchAfterReplace, replaceAll } from "../lib/search";
import {
  collectSourceAnchors,
  findPreviewScrollTopForSourceLine,
  findTextareaScrollTopForSourceLineOffsets
} from "../lib/scrollSync";
import type { PersistedViewMode } from "../lib/session";
import { getTextareaLineOffsets, type TextareaLineLayout } from "../lib/textareaLayout";

interface UseFindControllerOptions {
  content: string;
  onContentChange(content: string): void;
  previewScrollRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  viewMode: PersistedViewMode;
}

export function useFindController({
  content,
  onContentChange,
  previewScrollRef,
  textareaRef,
  viewMode
}: UseFindControllerOptions) {
  const [findOpen, setFindOpen] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusRef = useRef<number | null>(null);
  const textareaLineLayoutRef = useRef<TextareaLineLayout | null>(null);

  const searchResult = useMemo(
    () => findAll(content, searchQuery, { caseSensitive: matchCase, useRegex }),
    [content, searchQuery, matchCase, useRegex]
  );

  const openFind = useCallback(() => {
    setFindOpen(true);
    setReplaceVisible(false);
  }, []);

  const openReplace = useCallback(() => {
    setFindOpen(true);
    setReplaceVisible(true);
  }, []);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setReplaceVisible(false);
    setSearchQuery("");
    setReplaceQuery("");
    setCurrentMatch(0);
  }, []);

  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentMatch(0);
  }, []);

  const focusMatch = useCallback((index: number) => {
    if (!searchResult.indices[index]) return;
    const start = searchResult.indices[index];
    const end = start + searchResult.matchLengths[index];
    const lineCount = content.substring(0, start).split("\n").length;

    const textarea = textareaRef.current;
    const preview = previewScrollRef.current;

    if (viewMode === "edit" || viewMode === "split") {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start, end);
      // Measure real line offsets (soft-wrapping included) so the target line
      // lands on screen exactly like scroll-sync would place it.
      const offsets = getTextareaLineOffsets(textarea, textareaLineLayoutRef);
      const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
      textarea.scrollTop = findTextareaScrollTopForSourceLineOffsets(lineCount - 1, offsets, maxScrollTop);
      return;
    }

    if (!preview) return;
    const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight);
    const target = findPreviewScrollTopForSourceLine(
      lineCount - 1,
      collectSourceAnchors(preview),
      previewMax
    );
    if (target !== null) {
      preview.scrollTop = target;
    }
  }, [content, previewScrollRef, searchResult, textareaRef, viewMode]);

  // After a replace the content changes, so the next match can only be located
  // once the re-render produced fresh search results. Defer the focus to then.
  useEffect(() => {
    if (pendingFocusRef.current === null) return;
    const index = pendingFocusRef.current;
    pendingFocusRef.current = null;
    focusMatch(index);
  }, [focusMatch, searchResult]);

  const findNext = useCallback(() => {
    if (searchResult.count === 0) return;
    const next = currentMatch < searchResult.count - 1 ? currentMatch + 1 : 0;
    setCurrentMatch(next);
    focusMatch(next);
  }, [searchResult.count, currentMatch, focusMatch]);

  const findPrev = useCallback(() => {
    if (searchResult.count === 0) return;
    const prev = currentMatch > 0 ? currentMatch - 1 : searchResult.count - 1;
    setCurrentMatch(prev);
    focusMatch(prev);
  }, [searchResult.count, currentMatch, focusMatch]);

  const replaceCurrent = useCallback(() => {
    if (searchResult.count === 0 || !searchQuery) return;
    const start = searchResult.indices[currentMatch];
    if (start === undefined) return;
    const matchLen = searchResult.matchLengths[currentMatch];

    // Re-run the search against the new content so the counter and the next
    // selection stay in sync with what the replace actually produced.
    const { content: newContent, nextIndex } = findNextMatchAfterReplace(
      content,
      start,
      matchLen,
      searchQuery,
      replaceQuery,
      { caseSensitive: matchCase, useRegex }
    );

    pendingFocusRef.current = nextIndex;
    setCurrentMatch(nextIndex);
    onContentChange(newContent);
  }, [content, currentMatch, matchCase, onContentChange, replaceQuery, searchQuery, searchResult, useRegex]);

  const replaceAllMatches = useCallback(() => {
    if (!searchQuery) return;
    const newContent = replaceAll(content, searchQuery, replaceQuery, {
      caseSensitive: matchCase,
      useRegex
    });
    pendingFocusRef.current = 0;
    setCurrentMatch(0);
    onContentChange(newContent);
  }, [content, searchQuery, replaceQuery, matchCase, useRegex, onContentChange]);

  useEffect(() => {
    if (findOpen) {
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [findOpen]);

  return {
    closeFind,
    currentMatch,
    findInputRef,
    findNext,
    findOpen,
    findPrev,
    matchCase,
    openFind,
    openReplace,
    replaceAllMatches,
    replaceCurrent,
    replaceQuery,
    replaceVisible,
    searchQuery,
    searchResult,
    setMatchCase,
    setReplaceQuery,
    setUseRegex,
    updateSearchQuery,
    useRegex
  };
}
