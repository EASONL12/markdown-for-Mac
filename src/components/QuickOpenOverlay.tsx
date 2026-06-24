import type { RefObject } from "react";
import { getRecentDisplayName, type RecentFile } from "../lib/recentFiles";

interface QuickOpenOverlayProps {
  filteredRecentFiles: RecentFile[];
  recentInputRef: RefObject<HTMLInputElement | null>;
  recentSearch: string;
  onClose: () => void;
  onOpenRecentDocument: (path: string) => void;
  onRecentSearchChange: (query: string) => void;
}

export function QuickOpenOverlay({
  filteredRecentFiles,
  recentInputRef,
  recentSearch,
  onClose,
  onOpenRecentDocument,
  onRecentSearchChange
}: QuickOpenOverlayProps) {
  return (
    <div className="quick-open-overlay" role="dialog" aria-label="Open recent file">
      <div className="quick-open-header">
        <input
          ref={recentInputRef}
          type="text"
          placeholder="Search recent files..."
          value={recentSearch}
          onChange={(e) => onRecentSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filteredRecentFiles[0]) {
              onOpenRecentDocument(filteredRecentFiles[0].path);
            }
          }}
        />
        <button type="button" onClick={onClose} title="Close">✕</button>
      </div>
      <div className="quick-open-list">
        {filteredRecentFiles.length > 0 ? (
          filteredRecentFiles.map((file) => (
            <button
              className="quick-open-item"
              key={file.path}
              type="button"
              onClick={() => onOpenRecentDocument(file.path)}
              title={file.path}
            >
              <span>{getRecentDisplayName(file.path)}</span>
              <small>{file.path}</small>
            </button>
          ))
        ) : (
          <p className="quick-open-empty">No recent files</p>
        )}
      </div>
    </div>
  );
}
