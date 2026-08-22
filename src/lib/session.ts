import type { MarkdownWorkspace } from "./documentModel";
import {
  createDefaultReadingSettings,
  sanitizeReadingSettings,
  type ReadingSettings
} from "./readingSettings";
import {
  sanitizeReadingPositions,
  type ReadingPositions
} from "./readingPosition";

export type PersistedViewMode = "edit" | "split" | "preview" | "read";
export type PersistedThemeMode = "light" | "dark" | "system";

export interface PlainMarkSessionSnapshot {
  version: 2;
  readingPositions: ReadingPositions;
  readingSettings: ReadingSettings;
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
  themeMode: PersistedThemeMode,
  readingSettings: ReadingSettings = createDefaultReadingSettings(),
  readingPositions: ReadingPositions = {}
): PlainMarkSessionSnapshot {
  return {
    version: 2,
    readingPositions,
    readingSettings,
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
    if (parsed.version !== 1 && parsed.version !== 2) return null;
    const workspace = validateWorkspace(parsed.workspace);
    if (!workspace) return null;
    if (!validViewModes.has(parsed.viewMode as PersistedViewMode)) return null;
    if (!validThemeModes.has(parsed.themeMode as PersistedThemeMode)) return null;

    return {
      version: 2,
      readingPositions: parsed.version === 2 ? sanitizeReadingPositions(parsed.readingPositions) : {},
      readingSettings: parsed.version === 2
        ? sanitizeReadingSettings(parsed.readingSettings)
        : createDefaultReadingSettings(),
      workspace,
      viewMode: parsed.viewMode as PersistedViewMode,
      themeMode: parsed.themeMode as PersistedThemeMode
    };
  } catch {
    return null;
  }
}

// --- Split storage format -------------------------------------------------
// Documents and preferences live under separate keys so that frequent
// preference updates (reading positions on scroll) never re-serialize the
// full document contents. The single-blob format above remains as the
// migration path for existing sessions.

export interface SessionPreferencesPayload {
  readingPositions: ReadingPositions;
  readingSettings: ReadingSettings;
  themeMode: PersistedThemeMode;
  viewMode: PersistedViewMode;
}

function validateWorkspace(value: unknown): MarkdownWorkspace | null {
  if (!isMarkdownWorkspace(value)) return null;
  const workspace = value as MarkdownWorkspace;
  if (!workspace.documents.some((document) => document.id === workspace.activeDocumentId)) {
    return null;
  }
  return workspace;
}

export function createSessionDocumentsPayload(workspace: MarkdownWorkspace): string {
  return JSON.stringify({ version: 2, workspace });
}

export function createSessionPreferencesPayload(prefs: SessionPreferencesPayload): string {
  return JSON.stringify({ version: 2, ...prefs });
}

export function restoreSplitSession(
  documentsRaw: string | null,
  preferencesRaw: string | null
): PlainMarkSessionSnapshot | null {
  if (!documentsRaw) return null;

  try {
    const parsed: unknown = JSON.parse(documentsRaw);
    if (!isRecord(parsed) || parsed.version !== 2) return null;
    const workspace = validateWorkspace(parsed.workspace);
    if (!workspace) return null;

    let prefs: SessionPreferencesPayload = {
      readingPositions: {},
      readingSettings: createDefaultReadingSettings(),
      themeMode: "system",
      viewMode: "split"
    };

    if (preferencesRaw) {
      try {
        const parsedPrefs: unknown = JSON.parse(preferencesRaw);
        if (isRecord(parsedPrefs) && parsedPrefs.version === 2) {
          prefs = {
            readingPositions: sanitizeReadingPositions(parsedPrefs.readingPositions),
            readingSettings: sanitizeReadingSettings(parsedPrefs.readingSettings),
            themeMode: validThemeModes.has(parsedPrefs.themeMode as PersistedThemeMode)
              ? parsedPrefs.themeMode as PersistedThemeMode
              : prefs.themeMode,
            viewMode: validViewModes.has(parsedPrefs.viewMode as PersistedViewMode)
              ? parsedPrefs.viewMode as PersistedViewMode
              : prefs.viewMode
          };
        }
      } catch {
        // Keep defaults for unreadable preferences; documents still restore.
      }
    }

    return { version: 2, workspace, ...prefs };
  } catch {
    return null;
  }
}
