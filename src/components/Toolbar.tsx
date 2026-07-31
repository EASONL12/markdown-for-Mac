import { useEffect, useRef, useState } from "react";
import type { PersistedViewMode } from "../lib/session";
import {
  IconClock,
  IconFolder,
  IconMoon,
  IconSave,
  IconSaveAs,
  IconShare,
  IconSliders,
  IconSun
} from "./icons";

interface ToolbarProps {
  documentTitle: string;
  isDark: boolean;
  isDirty: boolean;
  viewMode: PersistedViewMode;
  onOpen: () => void;
  onOpenRecent: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onViewModeChange: (viewMode: PersistedViewMode) => void;
}

const viewModes: PersistedViewMode[] = ["edit", "split", "preview", "read"];

function getViewModeLabel(viewMode: PersistedViewMode): string {
  return viewMode.charAt(0).toUpperCase() + viewMode.slice(1);
}

export function Toolbar({
  documentTitle,
  isDark,
  isDirty,
  viewMode,
  onOpen,
  onOpenRecent,
  onSave,
  onSaveAs,
  onExportHtml,
  onExportPdf,
  onOpenSettings,
  onToggleTheme,
  onViewModeChange
}: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exportOpen]);

  return (
    <header className="toolbar">
      <div className="traffic-spacer" aria-hidden="true" />
      <div className="toolbar-group">
        <button type="button" className="icon-btn" onClick={onOpen} data-tooltip="Open… (⌘O)" aria-label="Open">
          <IconFolder />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenRecent}
          data-tooltip="Open Recent… (⇧⌘O)"
          aria-label="Open recent"
        >
          <IconClock />
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" className="icon-btn" onClick={onSave} data-tooltip="Save (⌘S)" aria-label="Save">
          <IconSave />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onSaveAs}
          data-tooltip="Save As… (⇧⌘S)"
          aria-label="Save as"
        >
          <IconSaveAs />
        </button>
      </div>
      <div className="toolbar-group menu-anchor" ref={exportRef}>
        <button
          type="button"
          className={exportOpen ? "icon-btn active" : "icon-btn"}
          onClick={() => setExportOpen((open) => !open)}
          data-tooltip="Export…"
          aria-label="Export"
          aria-haspopup="menu"
          aria-expanded={exportOpen}
        >
          <IconShare />
        </button>
        {exportOpen && (
          <div className="menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setExportOpen(false);
                onExportHtml();
              }}
            >
              Export HTML…
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setExportOpen(false);
                onExportPdf();
              }}
            >
              Export PDF…
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-title">
        <span>{documentTitle}</span>
        {isDirty && <span className="toolbar-title-dot" aria-hidden="true" />}
      </div>

      <div className="toolbar-right">
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
          className="icon-btn"
          onClick={onToggleTheme}
          data-tooltip={isDark ? "Switch to Light Mode (⇧⌘D)" : "Switch to Dark Mode (⇧⌘D)"}
          aria-label="Toggle dark mode"
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          data-tooltip="Reading Settings"
          aria-label="Reading settings"
        >
          <IconSliders />
        </button>
      </div>
    </header>
  );
}
