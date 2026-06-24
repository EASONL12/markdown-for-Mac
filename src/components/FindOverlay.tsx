import type { RefObject } from "react";

interface FindOverlayProps {
  currentMatch: number;
  findInputRef: RefObject<HTMLInputElement | null>;
  matchCase: boolean;
  replaceQuery: string;
  replaceVisible: boolean;
  searchQuery: string;
  totalMatches: number;
  useRegex: boolean;
  onClose: () => void;
  onFindNext: () => void;
  onFindPrev: () => void;
  onMatchCaseChange: (matchCase: boolean) => void;
  onReplaceAll: () => void;
  onReplaceCurrent: () => void;
  onReplaceQueryChange: (query: string) => void;
  onSearchQueryChange: (query: string) => void;
  onUseRegexChange: (useRegex: boolean) => void;
}

export function FindOverlay({
  currentMatch,
  findInputRef,
  matchCase,
  replaceQuery,
  replaceVisible,
  searchQuery,
  totalMatches,
  useRegex,
  onClose,
  onFindNext,
  onFindPrev,
  onMatchCaseChange,
  onReplaceAll,
  onReplaceCurrent,
  onReplaceQueryChange,
  onSearchQueryChange,
  onUseRegexChange
}: FindOverlayProps) {
  return (
    <div className="find-overlay">
      <div className="find-row">
        <input
          ref={findInputRef}
          type="text"
          placeholder="Find..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onFindNext();
            if (e.key === "Escape") onClose();
          }}
        />
        <button
          type="button"
          className={matchCase ? "active" : ""}
          onClick={() => onMatchCaseChange(!matchCase)}
          title="Match Case"
        >
          Aa
        </button>
        <button
          type="button"
          className={useRegex ? "active" : ""}
          onClick={() => onUseRegexChange(!useRegex)}
          title="Use Regex"
        >
          .*
        </button>
        <span className="find-count">
          {searchQuery ? (totalMatches > 0 ? `${currentMatch + 1}/${totalMatches}` : "No results") : ""}
        </span>
        <button type="button" onClick={onFindPrev} title="Previous">↑</button>
        <button type="button" onClick={onFindNext} title="Next">↓</button>
        <button type="button" onClick={onClose} title="Close">✕</button>
      </div>
      {replaceVisible && (
        <div className="find-row">
          <input
            type="text"
            placeholder="Replace..."
            value={replaceQuery}
            onChange={(e) => onReplaceQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onReplaceCurrent();
              if (e.key === "Escape") onClose();
            }}
          />
          <button type="button" onClick={onReplaceCurrent}>Replace</button>
          <button type="button" onClick={onReplaceAll}>All</button>
        </div>
      )}
    </div>
  );
}
