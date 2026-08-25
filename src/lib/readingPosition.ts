import type { MarkdownDocument } from "./documentModel";
import type { PersistedViewMode } from "./session";

export interface ReadingPosition {
  cursorEnd: number;
  cursorStart: number;
  previewScrollTop: number;
  textareaScrollTop: number;
  viewMode: PersistedViewMode;
  savedAt?: number;
}

export type ReadingPositions = Record<string, ReadingPosition>;

const validViewModes = new Set<PersistedViewMode>(["edit", "split", "preview", "read"]);

export function getDocumentPositionKey(document: Pick<MarkdownDocument, "id" | "path">): string {
  return document.path ?? document.id;
}

export function getDocumentViewMode(
  positions: ReadingPositions,
  key: string,
  defaultViewMode: PersistedViewMode
): PersistedViewMode {
  return positions[key]?.viewMode ?? defaultViewMode;
}

export function ensureReadingPositionViewMode(
  positions: ReadingPositions,
  key: string,
  viewMode: PersistedViewMode
): ReadingPositions {
  if (positions[key]) {
    return positions;
  }

  return {
    ...positions,
    [key]: {
      cursorEnd: 0,
      cursorStart: 0,
      previewScrollTop: 0,
      textareaScrollTop: 0,
      viewMode
    }
  };
}

export function rekeyReadingPosition(
  positions: ReadingPositions,
  previousKey: string,
  nextKey: string,
  pendingPosition?: ReadingPosition
): ReadingPositions {
  if (previousKey === nextKey) {
    return positions;
  }

  const position = pendingPosition ?? positions[previousKey];
  if (!position) {
    return positions;
  }

  const nextPositions = { ...positions };
  delete nextPositions[previousKey];
  nextPositions[nextKey] = position;
  return nextPositions;
}

function isValidPosition(value: unknown): value is ReadingPosition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.cursorEnd === "number" &&
    record.cursorEnd >= 0 &&
    typeof record.cursorStart === "number" &&
    record.cursorStart >= 0 &&
    typeof record.previewScrollTop === "number" &&
    record.previewScrollTop >= 0 &&
    typeof record.textareaScrollTop === "number" &&
    record.textareaScrollTop >= 0 &&
    validViewModes.has(record.viewMode as PersistedViewMode) &&
    (record.savedAt === undefined || typeof record.savedAt === "number")
  );
}

// Keep the newest `max` positions so long-lived sessions cannot grow the
// persisted blob without bound. Entries without a timestamp sort as oldest.
export function limitReadingPositions(positions: ReadingPositions, max: number): ReadingPositions {
  const entries = Object.entries(positions);
  if (entries.length <= max) {
    return positions;
  }
  return Object.fromEntries(
    [...entries]
      .sort(([, a], [, b]) => (a.savedAt ?? 0) - (b.savedAt ?? 0))
      .slice(-max)
  );
}

export function sanitizeReadingPositions(value: unknown): ReadingPositions {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const result: ReadingPositions = {};
  for (const [key, position] of Object.entries(value as Record<string, unknown>)) {
    if (isValidPosition(position)) {
      result[key] = position;
    }
  }
  return result;
}

export function updateReadingPosition(
  positions: ReadingPositions,
  key: string,
  position: ReadingPosition
): ReadingPositions {
  return {
    ...positions,
    [key]: { ...position, savedAt: Date.now() }
  };
}
