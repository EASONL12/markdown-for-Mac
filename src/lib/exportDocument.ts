export type ExportFormat = "html" | "pdf";
export type ExportTheme = "light" | "dark";
export type ConflictAction = "reload" | "keep-local" | "save-copy" | "dismiss";

export interface BuildExportHtmlOptions {
  bodyHtml: string;
  sourcePath: string | null;
  theme: ExportTheme;
}

export interface ConflictChoice {
  action: ConflictAction;
  label: string;
  description: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBaseName(filePath: string | null): string {
  if (!filePath) return "Untitled";
  const baseName = filePath.split(/[\\/]/).pop() || "Untitled";
  return baseName.replace(/\.[^.\\/]+$/, "") || "Untitled";
}

export function getDefaultExportPath(sourcePath: string | null, format: ExportFormat): string {
  const extension = `.${format}`;
  if (!sourcePath) {
    return `Untitled${extension}`;
  }

  const withoutExtension = sourcePath.replace(/\.[^.\\/]+$/, "");
  return `${withoutExtension}${extension}`;
}

export function getConflictCopyPath(sourcePath: string): string {
  const directoryMatch = sourcePath.match(/^(.*[\\/])?([^\\/]+)$/);
  const directory = directoryMatch?.[1] ?? "";
  const baseName = directoryMatch?.[2] ?? "Untitled.md";
  const extensionMatch = baseName.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? ".md";
  const nameWithoutExtension = extensionMatch
    ? baseName.slice(0, -extension.length)
    : baseName;

  return `${directory}${nameWithoutExtension}.local-copy${extension}`;
}

export function shouldAutoSaveDocument(
  path: string | null,
  isDirty: boolean,
  pendingConflictPath: string | null
): boolean {
  return Boolean(path && isDirty && path !== pendingConflictPath);
}

export function buildExportHtml({ bodyHtml, sourcePath, theme }: BuildExportHtmlOptions): string {
  const title = escapeHtml(getBaseName(sourcePath));

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css">
  <style>
    :root {
      color-scheme: light;
      --bg: #ffffff;
      --text: #17201d;
      --muted: #52635e;
      --border: #dce3e0;
      --code-bg: #eef3f1;
      --pre-bg: #101815;
      --pre-text: #d7ede7;
      --link: #0f7b66;
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --bg: #1a1e1c;
      --text: #e0e8e4;
      --muted: #8a9e96;
      --border: #3a403c;
      --code-bg: #2e3330;
      --pre-bg: #0f1512;
      --pre-text: #c8dbd4;
      --link: #3dd8b4;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.72;
    }
    .markdown-body {
      max-width: 820px;
      margin: 0 auto;
      padding: 48px 32px 72px;
    }
    h1, h2, h3 { line-height: 1.2; }
    h1 { margin: 0 0 18px; font-size: 34px; }
    h2 { margin: 32px 0 12px; font-size: 23px; }
    h3 { margin: 24px 0 10px; font-size: 18px; }
    p, ul, ol, blockquote, pre { margin: 0 0 16px; }
    a { color: var(--link); }
    blockquote {
      border-left: 3px solid var(--border);
      color: var(--muted);
      padding-left: 14px;
    }
    code {
      background: var(--code-bg);
      border-radius: 5px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.92em;
      padding: 2px 5px;
    }
    pre {
      background: var(--pre-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--pre-text);
      overflow: auto;
      padding: 14px 16px;
    }
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
  </style>
</head>
<body>
  <main class="markdown-body">
${bodyHtml}
  </main>
</body>
</html>
`;
}

export function buildConflictChoices(isDirty: boolean): ConflictChoice[] {
  if (!isDirty) {
    return [
      {
        action: "reload",
        label: "Reload",
        description: "Replace this tab with the version on disk."
      },
      {
        action: "dismiss",
        label: "Dismiss",
        description: "Keep the current view until the next file change."
      }
    ];
  }

  return [
    {
      action: "keep-local",
      label: "Keep Local",
      description: "Ignore the disk change and keep editing your unsaved version."
    },
    {
      action: "reload",
      label: "Reload",
      description: "Discard unsaved edits and load the version on disk."
    },
    {
      action: "save-copy",
      label: "Save Copy",
      description: "Save your current edits to a new file before reloading."
    }
  ];
}
