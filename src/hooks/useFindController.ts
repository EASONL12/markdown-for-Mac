import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findAll, replaceAll } from "../lib/search";

interface UseFindControllerOptions {
  content: string;
  onContentChange(content: string): void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useFindController({ content, onContentChange, textareaRef }: UseFindControllerOptions) {
  const [findOpen, setFindOpen] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

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
    const textarea = textareaRef.current;
    if (!textarea || !searchResult.indices[index]) return;
    const start = searchResult.indices[index];
    const end = start + searchResult.matchLengths[index];
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const lines = content.substring(0, start).split("\n");
    const lineNumber = lines.length;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
    textarea.scrollTop = (lineNumber - 3) * lineHeight;
  }, [searchResult, content, textareaRef]);

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
    const newContent =
      content.substring(0, start) +
      replaceQuery +
      content.substring(start + matchLen);
    onContentChange(newContent);
    const next = currentMatch < searchResult.count - 1 ? currentMatch : 0;
    setCurrentMatch(next);
  }, [searchResult, currentMatch, searchQuery, replaceQuery, content, onContentChange]);

  const replaceAllMatches = useCallback(() => {
    if (!searchQuery) return;
    const newContent = replaceAll(content, searchQuery, replaceQuery, {
      caseSensitive: matchCase,
      useRegex
    });
    onContentChange(newContent);
    setCurrentMatch(0);
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

