import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConflictDialog } from "./components/ConflictDialog";
import { FindOverlay } from "./components/FindOverlay";
import { QuickOpenOverlay } from "./components/QuickOpenOverlay";
import { Toolbar } from "./components/Toolbar";
import { useRecentFiles } from "./hooks/useRecentFiles";
import { useRestoredSession, useSessionPersistence } from "./hooks/useSessionPersistence";
import {
  addNewDocument,
  addOrActivateDocument,
  addOrActivateDocuments,
  createInitialWorkspace,
  getActiveDocument,
  getDisplayName,
  markActiveSaved,
  removeDocument,
  selectDocument,
  updateActiveContent
} from "./lib/documentModel";
import {
  buildExportHtml,
  getConflictCopyPath,
  getDefaultExportPath,
  shouldAutoSaveDocument,
  type ConflictAction,
  type ExportFormat
} from "./lib/exportDocument";
import { extractOutline, renderMarkdown } from "./lib/markdown";
import { findAll, replaceAll } from "./lib/search";
import {
  findPreviewScrollTop,
  findPreviewScrollTopForSourceLine,
  findSourceLineForPreviewScrollTop,
  findTextareaScrollTop,
  findTextareaScrollTopForSourceLine,
  findTextareaSourceLine,
  type SourceScrollAnchor
} from "./lib/scrollSync";
import type { PersistedThemeMode, PersistedViewMode } from "./lib/session";
import { getPlainMarkApi } from "./platform/plainmarkApi";
import "katex/dist/katex.min.css";
import "./styles.css";

type ViewMode = PersistedViewMode;
type ThemeMode = PersistedThemeMode;

function getLineHeight(textarea: HTMLTextAreaElement): number {
  const parsed = parseFloat(getComputedStyle(textarea).lineHeight);
  return Number.isFinite(parsed) ? parsed : 24;
}

function getLineCount(source: string): number {
  return source.split("\n").length;
}

function getPreviewSourceAnchors(container: HTMLElement): SourceScrollAnchor[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-source-line]"))
    .map((element) => {
      const line = Number(element.dataset.sourceLine);
      if (!Number.isFinite(line)) return null;
      return {
        line,
        scrollTop: Math.max(0, element.offsetTop - container.offsetTop)
      };
    })
    .filter((anchor): anchor is SourceScrollAnchor => anchor !== null);
}

function setScrollTopIfMeaningful(element: HTMLElement, targetScrollTop: number): void {
  if (Math.abs(element.scrollTop - targetScrollTop) > 1) {
    element.scrollTop = targetScrollTop;
  }
}

export default function App() {
  const restoredSession = useRestoredSession();
  const [workspace, setWorkspace] = useState(() => restoredSession?.workspace ?? createInitialWorkspace());
  const [viewMode, setViewMode] = useState<ViewMode>(() => restoredSession?.viewMode ?? "split");
  const [status, setStatus] = useState("Ready");
  const [version, setVersion] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => restoredSession?.themeMode ?? "system");
  const [recentOpen, setRecentOpen] = useState(false);
  const {
    filteredRecentFiles,
    recentSearch,
    rememberRecentPaths,
    removeRecentPath,
    setRecentSearch
  } = useRecentFiles();
  const isDark = useMemo(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return themeMode === "dark" || (themeMode === "system" && prefersDark);
  }, [themeMode]);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [pendingConflictPath, setPendingConflictPath] = useState<string | null>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const recentInputRef = useRef<HTMLInputElement>(null);
  const isSyncingRef = useRef(false);

  const api = useMemo(() => getPlainMarkApi(), []);

  useEffect(() => {
    api.getVersion().then(setVersion);
  }, [api]);
  const activeDocument = getActiveDocument(workspace);
  const rendered = useMemo(() => renderMarkdown(activeDocument.content), [activeDocument.content]);
  const outline = useMemo(() => extractOutline(activeDocument.content), [activeDocument.content]);

  useSessionPersistence(workspace, viewMode, themeMode);

  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); };
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(md|markdown|mdown|mkd|txt)$/i.test(f.name)
      );
      if (files.length === 0) return;
      const results = await Promise.all(
        files.map(async (file) => {
          const text = await file.text();
          return { path: file.name, content: text };
        })
      );
      setWorkspace((current) => addOrActivateDocuments(current, results));
      rememberRecentPaths(results.map((file) => file.path));
      setStatus(results.length === 1 ? `Opened ${results[0].path}` : `Opened ${results.length} files`);
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", handleDrop);
    };
  }, [rememberRecentPaths]);

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
      const sourceLine = findTextareaSourceLine(
        textarea.scrollTop,
        getLineHeight(textarea),
        getLineCount(textarea.value)
      );
      const anchoredScrollTop = findPreviewScrollTopForSourceLine(
        sourceLine,
        getPreviewSourceAnchors(preview),
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
        getPreviewSourceAnchors(preview),
        Math.max(0, getLineCount(textarea.value) - 1)
      );
      const anchoredScrollTop = sourceLine === null
        ? null
        : findTextareaScrollTopForSourceLine(sourceLine, getLineHeight(textarea), textareaMax);
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

  const searchResult = useMemo(
    () => findAll(activeDocument.content, searchQuery, { caseSensitive: matchCase, useRegex }),
    [activeDocument.content, searchQuery, matchCase, useRegex]
  );

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setReplaceVisible(false);
    setSearchQuery("");
    setReplaceQuery("");
    setCurrentMatch(0);
  }, []);

  const focusMatch = useCallback((index: number) => {
    const textarea = textareaRef.current;
    if (!textarea || !searchResult.indices[index]) return;
    const start = searchResult.indices[index];
    const end = start + searchResult.matchLengths[index];
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const lines = activeDocument.content.substring(0, start).split("\n");
    const lineNumber = lines.length;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24;
    textarea.scrollTop = (lineNumber - 3) * lineHeight;
  }, [searchResult, activeDocument.content]);

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
      activeDocument.content.substring(0, start) +
      replaceQuery +
      activeDocument.content.substring(start + matchLen);
    setWorkspace((current) => updateActiveContent(current, newContent));
    const next = currentMatch < searchResult.count - 1 ? currentMatch : 0;
    setCurrentMatch(next);
  }, [searchResult, currentMatch, searchQuery, replaceQuery, activeDocument.content, setWorkspace]);

  const replaceAllMatches = useCallback(() => {
    if (!searchQuery) return;
    const newContent = replaceAll(activeDocument.content, searchQuery, replaceQuery, {
      caseSensitive: matchCase,
      useRegex
    });
    setWorkspace((current) => updateActiveContent(current, newContent));
    setCurrentMatch(0);
  }, [activeDocument.content, searchQuery, replaceQuery, matchCase, useRegex, setWorkspace]);

  const openDocument = useCallback(async () => {
    const files = await api.openMarkdown();
    if (!files || files.length === 0) {
      return;
    }

    setWorkspace((current) => addOrActivateDocuments(current, files));
    rememberRecentPaths(files.map((file) => file.path));
    setStatus(files.length === 1 ? `Opened ${files[0].path}` : `Opened ${files.length} files`);
  }, [api, rememberRecentPaths]);

  const saveDocument = useCallback(async () => {
    const file = await api.saveMarkdown({
      path: activeDocument.path,
      content: activeDocument.content
    });

    if (!file) {
      return;
    }

    setWorkspace((current) => markActiveSaved(current, file.path));
    rememberRecentPaths([file.path]);
    setStatus(`Saved ${file.path}`);
  }, [activeDocument.content, activeDocument.path, api, rememberRecentPaths]);

  const saveDocumentAs = useCallback(async () => {
    const file = await api.saveMarkdownAs({
      path: activeDocument.path,
      content: activeDocument.content
    });

    if (!file) {
      return;
    }

    setWorkspace((current) => markActiveSaved(current, file.path));
    rememberRecentPaths([file.path]);
    setStatus(`Saved as ${file.path}`);
  }, [activeDocument.content, activeDocument.path, api, rememberRecentPaths]);

  const exportDocument = useCallback(async (format: ExportFormat) => {
    const html = buildExportHtml({
      bodyHtml: rendered,
      sourcePath: activeDocument.path,
      theme: isDark ? "dark" : "light"
    });
    const defaultPath = getDefaultExportPath(activeDocument.path, format);
    const exportedPath = format === "html"
      ? await api.exportHtml({ defaultPath, html })
      : await api.exportPdf({ defaultPath, html });

    if (exportedPath) {
      setStatus(`Exported ${exportedPath}`);
    }
  }, [activeDocument.path, api, isDark, rendered]);

  const openRecentPanel = useCallback(() => {
    setRecentOpen(true);
    setRecentSearch("");
    setTimeout(() => recentInputRef.current?.focus(), 50);
  }, []);

  const openRecentDocument = useCallback(async (path: string) => {
    try {
      const file = await api.readFile(path);
      if (!file) {
        removeRecentPath(path);
        setStatus(`Could not open ${path}`);
        return;
      }

      setWorkspace((current) => addOrActivateDocument(current, file));
      rememberRecentPaths([file.path]);
      setRecentOpen(false);
      setStatus(`Opened ${file.path}`);
    } catch {
      removeRecentPath(path);
      setStatus(`Could not open ${path}`);
    }
  }, [api, rememberRecentPaths, removeRecentPath]);

  const newDocument = useCallback(() => {
    setWorkspace((current) => addNewDocument(current));
    setStatus("New document");
  }, []);

  const closeDocument = useCallback((documentId?: string) => {
    const doc = documentId
      ? workspace.documents.find((d) => d.id === documentId)
      : activeDocument;
    if (!doc) return;
    if (doc.isDirty) {
      const confirmed = window.confirm("This document has unsaved changes. Close anyway?");
      if (!confirmed) return;
    }
    if (doc.path) {
      api.unwatchFile(doc.path);
    }
    setWorkspace((current) => removeDocument(current, doc.id));
    setStatus("Closed");
  }, [activeDocument, workspace.documents, api]);

  useEffect(() => {
    const removeExternal = api.onExternalFileOpen((file) => {
      setWorkspace((current) => addOrActivateDocument(current, file));
      rememberRecentPaths([file.path]);
      setStatus(`Opened ${file.path}`);
    });
    const removeOpen = api.onMenuOpen(openDocument);
    const removeOpenRecent = api.onMenuOpenRecent(openRecentPanel);
    const removeNew = api.onMenuNew(newDocument);
    const removeClose = api.onMenuClose(closeDocument);
    const removeSave = api.onMenuSave(saveDocument);
    const removeSaveAs = api.onMenuSaveAs(saveDocumentAs);
    const removeExportHtml = api.onMenuExportHtml(() => exportDocument("html"));
    const removeExportPdf = api.onMenuExportPdf(() => exportDocument("pdf"));
    const removeFind = api.onMenuFind(() => {
      setFindOpen(true);
      setReplaceVisible(false);
    });
    const removeReplace = api.onMenuReplace(() => {
      setFindOpen(true);
      setReplaceVisible(true);
    });

    return () => {
      removeExternal();
      removeOpen();
      removeOpenRecent();
      removeNew();
      removeClose();
      removeSave();
      removeSaveAs();
      removeExportHtml();
      removeExportPdf();
      removeFind();
      removeReplace();
    };
  }, [
    api,
    openDocument,
    openRecentPanel,
    newDocument,
    closeDocument,
    saveDocument,
    saveDocumentAs,
    exportDocument,
    rememberRecentPaths
  ]);

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

  useEffect(() => {
    const path = activeDocument.path;
    if (!shouldAutoSaveDocument(path, activeDocument.isDirty, pendingConflictPath)) return;

    const timer = setTimeout(async () => {
      const result = await api.saveMarkdown({ path, content: activeDocument.content });
      if (result) {
        setWorkspace((current) => markActiveSaved(current, result.path));
        setStatus("Auto-saved");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeDocument.content, activeDocument.path, activeDocument.isDirty, api, pendingConflictPath]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (workspace.documents.some((d) => d.isDirty)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [workspace.documents]);

  useEffect(() => {
    const paths = workspace.documents.filter((d) => d.path).map((d) => d.path as string);
    const uniquePaths = [...new Set(paths)];

    for (const p of uniquePaths) {
      api.watchFile(p);
    }

    return () => {
      for (const p of uniquePaths) {
        api.unwatchFile(p);
      }
    };
  }, [workspace.documents, api]);

  const reloadDocumentFromDisk = useCallback(async (filePath: string) => {
    const file = await api.readFile(filePath);
    if (file) {
      setWorkspace((current) => {
        const updated = current.documents.map((d) =>
          d.path === filePath ? { ...d, content: file.content, isDirty: false } : d
        );
        return { ...current, documents: updated };
      });
      setStatus(`Reloaded ${filePath}`);
    }
  }, [api]);

  useEffect(() => {
    const removeFileModified = api.onFileModified(async (filePath: string) => {
      const doc = workspace.documents.find((d) => d.path === filePath);
      if (!doc) return;

      if (doc.isDirty) {
        setPendingConflictPath(filePath);
        return;
      }

      await reloadDocumentFromDisk(filePath);
    });

    return () => { removeFileModified(); };
  }, [workspace.documents, api, reloadDocumentFromDisk]);

  const handleConflictAction = useCallback(async (action: ConflictAction) => {
    if (!pendingConflictPath) return;

    const filePath = pendingConflictPath;
    const doc = workspace.documents.find((d) => d.path === filePath);
    setPendingConflictPath(null);

    if (action === "keep-local" || action === "dismiss" || !doc) {
      setStatus(action === "keep-local" ? "Kept local edits" : "Dismissed external change");
      return;
    }

    if (action === "save-copy") {
      const savedCopy = await api.saveMarkdownAs({
        path: getConflictCopyPath(filePath),
        content: doc.content
      });
      if (!savedCopy) {
        setStatus("Save copy canceled");
        return;
      }
      rememberRecentPaths([savedCopy.path]);
    }

    await reloadDocumentFromDisk(filePath);
  }, [api, pendingConflictPath, reloadDocumentFromDisk, rememberRecentPaths, workspace.documents]);

  useEffect(() => {
    if (findOpen) {
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [findOpen]);

  return (
    <main className="app-shell">
      <Toolbar
        isDark={isDark}
        viewMode={viewMode}
        onOpen={openDocument}
        onOpenRecent={openRecentPanel}
        onSave={saveDocument}
        onSaveAs={saveDocumentAs}
        onExportHtml={() => exportDocument("html")}
        onExportPdf={() => exportDocument("pdf")}
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
                  onClick={() => {
                    setWorkspace((current) => selectDocument(current, document.id));
                    setStatus(document.path ? `Viewing ${document.path}` : "Viewing unsaved file");
                  }}
                >
                  <span className="file-dot" aria-hidden="true" />
                  <span>{getDisplayName(document)}</span>
                </button>
                <button
                  className="file-close-btn"
                  type="button"
                  title="Close"
                  onClick={(e) => { e.stopPropagation(); closeDocument(document.id); }}
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
              onChange={(event) => setWorkspace((current) => updateActiveContent(current, event.target.value))}
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

      {findOpen && (
        <FindOverlay
          currentMatch={currentMatch}
          findInputRef={findInputRef}
          matchCase={matchCase}
          replaceQuery={replaceQuery}
          replaceVisible={replaceVisible}
          searchQuery={searchQuery}
          totalMatches={searchResult.count}
          useRegex={useRegex}
          onClose={closeFind}
          onFindNext={findNext}
          onFindPrev={findPrev}
          onMatchCaseChange={setMatchCase}
          onReplaceAll={replaceAllMatches}
          onReplaceCurrent={replaceCurrent}
          onReplaceQueryChange={setReplaceQuery}
          onSearchQueryChange={(query) => {
            setSearchQuery(query);
            setCurrentMatch(0);
          }}
          onUseRegexChange={setUseRegex}
        />
      )}

      {recentOpen && (
        <QuickOpenOverlay
          filteredRecentFiles={filteredRecentFiles}
          recentInputRef={recentInputRef}
          recentSearch={recentSearch}
          onClose={() => setRecentOpen(false)}
          onOpenRecentDocument={openRecentDocument}
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
