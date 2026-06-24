export interface OpenedMarkdownFile {
  path: string;
  content: string;
}

export interface SaveMarkdownFile {
  path: string | null;
  content: string;
}

export interface ExportDocumentFile {
  defaultPath: string;
  html: string;
}

export interface PlainMarkApi {
  openMarkdown(): Promise<OpenedMarkdownFile[] | null>;
  saveMarkdown(file: SaveMarkdownFile): Promise<OpenedMarkdownFile | null>;
  saveMarkdownAs(file: SaveMarkdownFile): Promise<OpenedMarkdownFile | null>;
  exportHtml(file: ExportDocumentFile): Promise<string | null>;
  exportPdf(file: ExportDocumentFile): Promise<string | null>;
  onExternalFileOpen(callback: (file: OpenedMarkdownFile) => void): () => void;
  onMenuOpen(callback: () => void): () => void;
  onMenuOpenRecent(callback: () => void): () => void;
  onMenuNew(callback: () => void): () => void;
  onMenuClose(callback: () => void): () => void;
  onMenuSave(callback: () => void): () => void;
  onMenuSaveAs(callback: () => void): () => void;
  onMenuExportHtml(callback: () => void): () => void;
  onMenuExportPdf(callback: () => void): () => void;
  setTheme(mode: "light" | "dark" | "system"): Promise<void>;
  getTheme(): Promise<"light" | "dark">;
  onMenuToggleDark(callback: () => void): () => void;
  onMenuFind(callback: () => void): () => void;
  onMenuReplace(callback: () => void): () => void;
  watchFile(filePath: string): Promise<void>;
  unwatchFile(filePath: string): Promise<void>;
  onFileModified(callback: (filePath: string) => void): () => void;
  readFile(filePath: string): Promise<OpenedMarkdownFile | null>;
  getVersion(): Promise<string>;
}

declare global {
  interface Window {
    plainmark: PlainMarkApi;
  }
}
