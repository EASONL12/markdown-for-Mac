import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConflictDialog } from "./components/ConflictDialog";
import { FindOverlay } from "./components/FindOverlay";
import { QuickOpenOverlay } from "./components/QuickOpenOverlay";
import { Toolbar } from "./components/Toolbar";
import { useAppMenuBindings } from "./hooks/useAppMenuBindings";
import { useDocumentCommands } from "./hooks/useDocumentCommands";
import { useDocumentDrop } from "./hooks/useDocumentDrop";
import { useFileConflictController } from "./hooks/useFileConflictController";
import { useFindController } from "./hooks/useFindController";
import { useRecentFiles } from "./hooks/useRecentFiles";
import { useScrollSyncController } from "./hooks/useScrollSyncController";
import { useRestoredSession, useSessionPersistence } from "./hooks/useSessionPersistence";
import {
  createInitialWorkspace,
  getActiveDocument,
  getDisplayName,
  updateActiveContent
} from "./lib/documentModel";
import { extractOutline, renderMarkdown } from "./lib/markdown";
import type { PersistedThemeMode, PersistedViewMode } from "./lib/session";
import { getPlainMarkApi } from "./platform/plainmarkApi";
import "katex/dist/katex.min.css";
import "./styles.css";

type ViewMode = PersistedViewMode;
type ThemeMode = PersistedThemeMode;

export default function App() {
  const restoredSession = useRestoredSession();
  const [workspace, setWorkspace] = useState(() => restoredSession?.workspace ?? createInitialWorkspace());
  const [viewMode, setViewMode] = useState<ViewMode>(() => restoredSession?.viewMode ?? "split");
  const [status, setStatus] = useState("Ready");
  const [version, setVersion] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => restoredSession?.themeMode ?? "system");
  const [recentOpen, setRecentOpen] = useState(false);
  const recentInputRef = useRef<HTMLInputElement>(null);
  const {
    filteredRecentFiles,
    recentSearch,
    rememberRecentPaths,
    removeRecentPath,
    setRecentSearch
  } = useRecentFiles();

  const api = useMemo(() => getPlainMarkApi(), []);
  const activeDocument = getActiveDocument(workspace);
  const rendered = useMemo(() => renderMarkdown(activeDocument.content), [activeDocument.content]);
  const outline = useMemo(() => extractOutline(activeDocument.content), [activeDocument.content]);
  const isDark = useMemo(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return themeMode === "dark" || (themeMode === "system" && prefersDark);
  }, [themeMode]);

  useEffect(() => {
    api.getVersion().then(setVersion);
  }, [api]);

  useSessionPersistence(workspace, viewMode, themeMode);

  const {
    handlePreviewScroll,
    handleTextareaScroll,
    previewScrollRef,
    scrollToHeading,
    textareaRef
  } = useScrollSyncController(viewMode);

  const updateActiveDocumentContent = useCallback((content: string) => {
    setWorkspace((current) => updateActiveContent(current, content));
  }, []);

  const find = useFindController({
    content: activeDocument.content,
    onContentChange: updateActiveDocumentContent,
    textareaRef
  });

  const documentCommands = useDocumentCommands({
    activeDocument,
    api,
    isDark,
    recentInputRef,
    rememberRecentPaths,
    removeRecentPath,
    rendered,
    setRecentOpen,
    setRecentSearch,
    setStatus,
    setWorkspace,
    workspace
  });

  useDocumentDrop(documentCommands.openDroppedFiles);

  useAppMenuBindings({
    api,
    closeDocument: documentCommands.closeDocument,
    exportDocument: documentCommands.exportDocument,
    newDocument: documentCommands.newDocument,
    onExternalFileOpen: documentCommands.openExternalFile,
    openDocument: documentCommands.openDocument,
    openFind: find.openFind,
    openRecentPanel: documentCommands.openRecentPanel,
    openReplace: find.openReplace,
    saveDocument: documentCommands.saveDocument,
    saveDocumentAs: documentCommands.saveDocumentAs
  });

  useEffect(() => {
    const root = document.documentElement;

    function applyTheme() {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = themeMode === "dark" || (themeMode === "system" && prefersDark);
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
    }

    applyTheme();
    api.setTheme(themeMode);

    if (themeMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [themeMode, api]);

  useEffect(() => {
    const removeToggle = api.onMenuToggleDark(() => {
      setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
    });
    return () => { removeToggle(); };
  }, [api]);

  const { handleConflictAction, pendingConflictPath } = useFileConflictController({
    activeDocument,
    api,
    rememberRecentPaths,
    setStatus,
    setWorkspace,
    workspace
  });

  return (
    <main className="app-shell">
      <Toolbar
        isDark={isDark}
        viewMode={viewMode}
        onOpen={documentCommands.openDocument}
        onOpenRecent={documentCommands.openRecentPanel}
        onSave={documentCommands.saveDocument}
        onSaveAs={documentCommands.saveDocumentAs}
        onExportHtml={() => documentCommands.exportDocument("html")}
        onExportPdf={() => documentCommands.exportDocument("pdf")}
        onToggleTheme={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
        onViewModeChange={setViewMode}
      />

      <section className={`workspace ${viewMode === "read" ? "workspace-read" : ""}`}>
        <aside className="file-rail">
          <p className="rail-label">Open Files</p>
          <div className="file-list">
            {workspace.documents.map((document) => (
              <div
                className={`file-item ${document.id === workspace.activeDocumentId ? "selected" : ""}`}
                key={document.id}
              >
                <button
                  className="file-item-btn"
                  type="button"
                  title={document.path ?? "Unsaved file"}
                  onClick={() => documentCommands.selectDocumentById(document)}
                >
                  <span className="file-dot" aria-hidden="true" />
                  <span>{getDisplayName(document)}</span>
                </button>
                <button
                  className="file-close-btn"
                  type="button"
                  title="Close"
                  onClick={(event) => { event.stopPropagation(); documentCommands.closeDocument(document.id); }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className={`editor-grid mode-${viewMode}`}>
          <label className="pane editor-pane">
            <span className="pane-title">Markdown</span>
            <textarea
              ref={textareaRef}
              value={activeDocument.content}
              spellCheck="false"
              onChange={(event) => updateActiveDocumentContent(event.target.value)}
              onScroll={handleTextareaScroll}
              aria-label="Markdown editor"
            />
          </label>

          <article className="pane preview-pane">
            <div className="pane-title">{viewMode === "read" ? "Reading" : "Preview"}</div>
            <div
              className="markdown-preview"
              ref={previewScrollRef}
              onScroll={handlePreviewScroll}
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          </article>
        </section>

        <aside className="outline-rail" aria-label="Document outline">
          <p className="rail-label">Outline</p>
          {outline.length > 0 ? (
            <nav className="outline-list">
              {outline.map((item) => (
                <button
                  className={`outline-item outline-level-${Math.min(item.level, 4)}`}
                  key={`${item.id}-${item.title}`}
                  type="button"
                  onClick={() => scrollToHeading(item.id)}
                  title={item.title}
                >
                  {item.title}
                </button>
              ))}
            </nav>
          ) : (
            <p className="outline-empty">No headings</p>
          )}
        </aside>
      </section>

      <footer className="statusbar">
        <span>{status}</span>
        <span>{activeDocument.content.length} chars</span>
        <span>v{version}</span>
      </footer>

      {find.findOpen && (
        <FindOverlay
          currentMatch={find.currentMatch}
          findInputRef={find.findInputRef}
          matchCase={find.matchCase}
          replaceQuery={find.replaceQuery}
          replaceVisible={find.replaceVisible}
          searchQuery={find.searchQuery}
          totalMatches={find.searchResult.count}
          useRegex={find.useRegex}
          onClose={find.closeFind}
          onFindNext={find.findNext}
          onFindPrev={find.findPrev}
          onMatchCaseChange={find.setMatchCase}
          onReplaceAll={find.replaceAllMatches}
          onReplaceCurrent={find.replaceCurrent}
          onReplaceQueryChange={find.setReplaceQuery}
          onSearchQueryChange={find.updateSearchQuery}
          onUseRegexChange={find.setUseRegex}
        />
      )}

      {recentOpen && (
        <QuickOpenOverlay
          filteredRecentFiles={filteredRecentFiles}
          recentInputRef={recentInputRef}
          recentSearch={recentSearch}
          onClose={() => setRecentOpen(false)}
          onOpenRecentDocument={documentCommands.openRecentDocument}
          onRecentSearchChange={setRecentSearch}
        />
      )}

      {pendingConflictPath && (
        <ConflictDialog
          filePath={pendingConflictPath}
          isDirty={workspace.documents.some((document) => document.path === pendingConflictPath && document.isDirty)}
          onAction={handleConflictAction}
        />
      )}
    </main>
  );
}
