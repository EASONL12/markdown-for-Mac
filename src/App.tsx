import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { extractOutline, renderMarkdown } from "./lib/markdown";
import { findAll, replaceAll } from "./lib/search";
import { findPreviewScrollTop, findTextareaScrollTop } from "./lib/scrollSync";
import { getPlainMarkApi } from "./platform/plainmarkApi";
import "katex/dist/katex.min.css";
import "./styles.css";

type ViewMode = "edit" | "split" | "preview" | "read";
type ThemeMode = "light" | "dark" | "system";

export default function App() {
  const [workspace, setWorkspace] = useState(createInitialWorkspace);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [status, setStatus] = useState("Ready");
  const [version, setVersion] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
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
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const isSyncingRef = useRef(false);

  const api = useMemo(() => getPlainMarkApi(), []);

  useEffect(() => {
    api.getVersion().then(setVersion);
  }, [api]);
  const activeDocument = getActiveDocument(workspace);
  const rendered = useMemo(() => renderMarkdown(activeDocument.content), [activeDocument.content]);
  const outline = useMemo(() => extractOutline(activeDocument.content), [activeDocument.content]);

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
      setStatus(results.length === 1 ? `Opened ${results[0].path}` : `Opened ${results.length} files`);
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", handleDrop);
    };
  }, [api]);

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

      const targetScroll = findPreviewScrollTop(
        textarea.scrollTop,
        textarea.scrollHeight,
        textarea.clientHeight,
        preview.scrollHeight,
        preview.clientHeight
      );
      preview.scrollTop = targetScroll;
      setTimeout(() => { isSyncingRef.current = false; }, 50);
    });
  }, [viewMode]);

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

      const targetScroll = findTextareaScrollTop(
        preview.scrollTop,
        preview.scrollHeight,
        preview.clientHeight,
        textarea.scrollHeight,
        textarea.clientHeight
      );
      textarea.scrollTop = targetScroll;
      setTimeout(() => { isSyncingRef.current = false; }, 50);
    });
  }, [viewMode]);

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
    setStatus(files.length === 1 ? `Opened ${files[0].path}` : `Opened ${files.length} files`);
  }, [api]);

  const saveDocument = useCallback(async () => {
    const file = await api.saveMarkdown({
      path: activeDocument.path,
      content: activeDocument.content
    });

    if (!file) {
      return;
    }

    setWorkspace((current) => markActiveSaved(current, file.path));
    setStatus(`Saved ${file.path}`);
  }, [activeDocument.content, activeDocument.path, api]);

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
      setStatus(`Opened ${file.path}`);
    });
    const removeOpen = api.onMenuOpen(openDocument);
    const removeNew = api.onMenuNew(newDocument);
    const removeClose = api.onMenuClose(closeDocument);
    const removeSave = api.onMenuSave(saveDocument);
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
      removeNew();
      removeClose();
      removeSave();
      removeFind();
      removeReplace();
    };
  }, [api, openDocument, newDocument, closeDocument, saveDocument]);

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
    if (!path || !activeDocument.isDirty) return;

    const timer = setTimeout(async () => {
      const result = await api.saveMarkdown({ path, content: activeDocument.content });
      if (result) {
        setWorkspace((current) => markActiveSaved(current, result.path));
        setStatus("Auto-saved");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeDocument.content, activeDocument.path, activeDocument.isDirty, api]);

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

  useEffect(() => {
    const removeFileModified = api.onFileModified(async (filePath: string) => {
      const doc = workspace.documents.find((d) => d.path === filePath);
      if (!doc) return;

      if (doc.isDirty) {
        const choice = window.confirm(
          `"${filePath}" has been modified externally.\n\nReload from disk? (Cancel to keep your changes)`
        );
        if (!choice) return;
      }

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
    });

    return () => { removeFileModified(); };
  }, [workspace.documents, api]);

  useEffect(() => {
    if (findOpen) {
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [findOpen]);

  return (
    <main className="app-shell">
      <header className="toolbar">
        <div className="traffic-spacer" aria-hidden="true" />
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>PlainMark</span>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={openDocument}>Open</button>
          <button type="button" onClick={saveDocument}>Save</button>
        </div>
        <div className="segmented" aria-label="View mode">
          <button className={viewMode === "edit" ? "active" : ""} type="button" onClick={() => setViewMode("edit")}>Edit</button>
          <button className={viewMode === "split" ? "active" : ""} type="button" onClick={() => setViewMode("split")}>Split</button>
          <button className={viewMode === "preview" ? "active" : ""} type="button" onClick={() => setViewMode("preview")}>Preview</button>
          <button className={viewMode === "read" ? "active" : ""} type="button" onClick={() => setViewMode("read")}>Read</button>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </header>

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
        <div className="find-overlay">
          <div className="find-row">
            <input
              ref={findInputRef}
              type="text"
              placeholder="Find..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatch(0); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") findNext();
                if (e.key === "Escape") closeFind();
              }}
            />
            <button
              type="button"
              className={matchCase ? "active" : ""}
              onClick={() => setMatchCase((p) => !p)}
              title="Match Case"
            >
              Aa
            </button>
            <button
              type="button"
              className={useRegex ? "active" : ""}
              onClick={() => setUseRegex((p) => !p)}
              title="Use Regex"
            >
              .*
            </button>
            <span className="find-count">
              {searchQuery ? (searchResult.count > 0 ? `${currentMatch + 1}/${searchResult.count}` : "No results") : ""}
            </span>
            <button type="button" onClick={findPrev} title="Previous">↑</button>
            <button type="button" onClick={findNext} title="Next">↓</button>
            <button type="button" onClick={closeFind} title="Close">✕</button>
          </div>
          {replaceVisible && (
            <div className="find-row">
              <input
                type="text"
                placeholder="Replace..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") replaceCurrent();
                  if (e.key === "Escape") closeFind();
                }}
              />
              <button type="button" onClick={replaceCurrent}>Replace</button>
              <button type="button" onClick={replaceAllMatches}>All</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
