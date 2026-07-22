export interface ResolvedMarkdownHref {
  anchor: string | null;
  path: string;
}

const markdownExtensionPattern = /\.(md|markdown|mdown|mkd|txt)$/i;
const remoteHrefPattern = /^[a-z][a-z0-9+.-]*:/i;

export function isLocalMarkdownHref(href: string): boolean {
  if (!href || href.startsWith("#") || remoteHrefPattern.test(href)) {
    return false;
  }

  const [pathPart] = href.split("#", 1);
  return markdownExtensionPattern.test(decodeURIComponent(pathPart));
}

function normalizePath(path: string): string {
  const isAbsolute = path.startsWith("/");
  const parts: string[] = [];

  for (const part of path.split(/[\\/]+/)) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return `${isAbsolute ? "/" : ""}${parts.join("/")}`;
}

function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

export function resolveMarkdownHref(currentDocumentPath: string | null, href: string): ResolvedMarkdownHref | null {
  if (!currentDocumentPath || !isLocalMarkdownHref(href)) {
    return null;
  }

  const [rawPath, rawAnchor] = href.split("#");
  const decodedPath = decodeURIComponent(rawPath);
  const path = decodedPath.startsWith("/")
    ? normalizePath(decodedPath)
    : normalizePath(`${dirname(currentDocumentPath)}/${decodedPath}`);

  return {
    anchor: rawAnchor ? decodeURIComponent(rawAnchor) : null,
    path
  };
}

function toFileUrl(filePath: string): string {
  return `file://${filePath.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

export function resolveLocalAssetHref(currentDocumentPath: string | null, href: string): string {
  if (!currentDocumentPath || !href || href.startsWith("data:") || remoteHrefPattern.test(href)) {
    return href;
  }

  const [rawPath] = href.split("#");
  const decodedPath = decodeURIComponent(rawPath);
  const resolvedPath = decodedPath.startsWith("/")
    ? normalizePath(decodedPath)
    : normalizePath(`${dirname(currentDocumentPath)}/${decodedPath}`);

  return toFileUrl(resolvedPath);
}
