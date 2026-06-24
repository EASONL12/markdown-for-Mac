import type { PersistedViewMode } from "./session";

export interface ReadingSettings {
  autoSave: boolean;
  defaultViewMode: PersistedViewMode;
  fontSize: number;
  lineHeight: number;
  readingWidth: number;
}

const defaultReadingSettings: ReadingSettings = {
  autoSave: true,
  defaultViewMode: "split",
  fontSize: 16,
  lineHeight: 1.72,
  readingWidth: 820
};

const validViewModes = new Set<PersistedViewMode>(["edit", "split", "preview", "read"]);

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function createDefaultReadingSettings(): ReadingSettings {
  return { ...defaultReadingSettings };
}

export function sanitizeReadingSettings(value: unknown): ReadingSettings {
  if (typeof value !== "object" || value === null) {
    return createDefaultReadingSettings();
  }

  const record = value as Record<string, unknown>;
  const defaults = createDefaultReadingSettings();
  return {
    autoSave: typeof record.autoSave === "boolean" ? record.autoSave : defaults.autoSave,
    defaultViewMode: validViewModes.has(record.defaultViewMode as PersistedViewMode)
      ? record.defaultViewMode as PersistedViewMode
      : defaults.defaultViewMode,
    fontSize: clampNumber(record.fontSize, defaults.fontSize, 13, 22),
    lineHeight: clampNumber(record.lineHeight, defaults.lineHeight, 1.4, 2.1),
    readingWidth: clampNumber(record.readingWidth, defaults.readingWidth, 560, 1100)
  };
}

