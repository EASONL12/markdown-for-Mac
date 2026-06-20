import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addOrActivateDocument,
  addOrActivateDocuments,
  createInitialWorkspace,
  getActiveDocument,
  getDisplayName,
  markActiveSaved,
  selectDocument,
  updateActiveContent
} from "./lib/documentModel";
import { extractOutline, renderMarkdown } from "./lib/markdown";
import { getPlainMarkApi } from "./platform/plainmarkApi";
import "katex/dist/katex.min.css";
import "./styles.css";

type ViewMode = "edit" | "split" | "preview" | "read";

export default function App() {
  const [workspace, setWorkspace] = useState(createInitialWorkspace);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [status, setStatus] = useState("Ready");
  const previewScrollRef = useRef<HTMLDivElement>(null);

  const api = useMemo(() => getPlainMarkApi(), []);
  const activeDocument = getActiveDocument(workspace);
  const rendered = useMemo(() => renderMarkdown(activeDocument.content), [activeDocument.content]);
  const outline = useMemo(() => extractOutline(activeDocument.content), [activeDocument.content]);

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

  useEffect(() => {
    const removeExternal = api.onExternalFileOpen((file) => {
      setWorkspace((current) => addOrActivateDocument(current, file));
      setStatus(`Opened ${file.path}`);
    });
    const removeOpen = api.onMenuOpen(openDocument);
    const removeSave = api.onMenuSave(saveDocument);

    return () => {
      removeExternal();
      removeOpen();
      removeSave();
    };
  }, [api, openDocument, saveDocument]);

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
      </header>

      <section className={`workspace ${viewMode === "read" ? "workspace-read" : ""}`}>
        <aside className="file-rail">
          <p className="rail-label">Open Files</p>
          <div className="file-list">
            {workspace.documents.map((document) => (
              <button
                className={`file-item ${document.id === workspace.activeDocumentId ? "selected" : ""}`}
                key={document.id}
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
            ))}
          </div>
        </aside>

        <section className={`editor-grid mode-${viewMode}`}>
          <label className="pane editor-pane">
            <span className="pane-title">Markdown</span>
            <textarea
              value={activeDocument.content}
              spellCheck="false"
              onChange={(event) => setWorkspace((current) => updateActiveContent(current, event.target.value))}
              aria-label="Markdown editor"
            />
          </label>

          <article className="pane preview-pane">
            <div className="pane-title">{viewMode === "read" ? "Reading" : "Preview"}</div>
            <div className="markdown-preview" ref={previewScrollRef} dangerouslySetInnerHTML={{ __html: rendered }} />
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
      </footer>
    </main>
  );
}
