import type { PersistedViewMode } from "../lib/session";

interface ToolbarProps {
  isDark: boolean;
  viewMode: PersistedViewMode;
  onOpen: () => void;
  onOpenRecent: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onToggleTheme: () => void;
  onViewModeChange: (viewMode: PersistedViewMode) => void;
}

const viewModes: PersistedViewMode[] = ["edit", "split", "preview", "read"];

function getViewModeLabel(viewMode: PersistedViewMode): string {
  return viewMode.charAt(0).toUpperCase() + viewMode.slice(1);
}

export function Toolbar({
  isDark,
  viewMode,
  onOpen,
  onOpenRecent,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onToggleTheme,
  onViewModeChange
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="traffic-spacer" aria-hidden="true" />
      <div className="brand">
        <span className="brand-mark">P</span>
        <span>PlainMark</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" onClick={onOpen}>Open</button>
        <button type="button" onClick={onOpenRecent}>Recent</button>
        <button type="button" onClick={onSave}>Save</button>
        <button type="button" onClick={onSaveAs}>Save As</button>
        <button type="button" onClick={onExportHtml}>HTML</button>
        <button type="button" onClick={onExportPdf}>PDF</button>
      </div>
      <div className="segmented" aria-label="View mode">
        {viewModes.map((mode) => (
          <button
            className={viewMode === mode ? "active" : ""}
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
          >
            {getViewModeLabel(mode)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="theme-toggle"
        onClick={onToggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? "☀️" : "🌙"}
      </button>
    </header>
  );
}
