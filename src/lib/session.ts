import type { MarkdownWorkspace } from "./documentModel";

export type PersistedViewMode = "edit" | "split" | "preview" | "read";
export type PersistedThemeMode = "light" | "dark" | "system";

export interface PlainMarkSessionSnapshot {
  version: 1;
  workspace: MarkdownWorkspace;
  viewMode: PersistedViewMode;
  themeMode: PersistedThemeMode;
}

const validViewModes = new Set<PersistedViewMode>(["edit", "split", "preview", "read"]);
const validThemeModes = new Set<PersistedThemeMode>(["light", "dark", "system"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMarkdownWorkspace(value: unknown): value is MarkdownWorkspace {
  if (!isRecord(value) || !Array.isArray(value.documents) || typeof value.activeDocumentId !== "string") {
    return false;
  }

  if (value.documents.length === 0) {
    return false;
  }

  return value.documents.every((document) => {
    if (!isRecord(document)) return false;
    return (
      typeof document.id === "string" &&
      (typeof document.path === "string" || document.path === null) &&
      typeof document.content === "string" &&
      typeof document.isDirty === "boolean"
    );
  });
}

export function createSessionSnapshot(
  workspace: MarkdownWorkspace,
  viewMode: PersistedViewMode,
  themeMode: PersistedThemeMode
): PlainMarkSessionSnapshot {
  return {
    version: 1,
    workspace,
    viewMode,
    themeMode
  };
}

export function restoreSessionSnapshot(_serialized: string | null): PlainMarkSessionSnapshot | null {
  if (!_serialized) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(_serialized);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== 1) return null;
    const workspace = parsed.workspace;
    if (!isMarkdownWorkspace(workspace)) return null;
    if (!validViewModes.has(parsed.viewMode as PersistedViewMode)) return null;
    if (!validThemeModes.has(parsed.themeMode as PersistedThemeMode)) return null;
    if (!workspace.documents.some((document) => document.id === workspace.activeDocumentId)) {
      return null;
    }

    return {
      version: 1,
      workspace,
      viewMode: parsed.viewMode as PersistedViewMode,
      themeMode: parsed.themeMode as PersistedThemeMode
    };
  } catch {
    return null;
  }
}
