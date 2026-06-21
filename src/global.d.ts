export interface OpenedMarkdownFile {
  path: string;
  content: string;
}

export interface SaveMarkdownFile {
  path: string | null;
  content: string;
}

export interface PlainMarkApi {
  openMarkdown(): Promise<OpenedMarkdownFile[] | null>;
  saveMarkdown(file: SaveMarkdownFile): Promise<OpenedMarkdownFile | null>;
  onExternalFileOpen(callback: (file: OpenedMarkdownFile) => void): () => void;
  onMenuOpen(callback: () => void): () => void;
  onMenuSave(callback: () => void): () => void;
  setTheme(mode: "light" | "dark" | "system"): Promise<void>;
  getTheme(): Promise<"light" | "dark">;
  onMenuToggleDark(callback: () => void): () => void;
  onMenuFind(callback: () => void): () => void;
  onMenuReplace(callback: () => void): () => void;
}

declare global {
  interface Window {
    plainmark: PlainMarkApi;
  }
}
