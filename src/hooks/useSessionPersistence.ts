import { useEffect, useMemo, useRef } from "react";
import type { MarkdownWorkspace } from "../lib/documentModel";
import {
  createSessionSnapshot,
  restoreSessionSnapshot,
  type PersistedThemeMode,
  type PersistedViewMode
} from "../lib/session";
import type { ReadingPositions } from "../lib/readingPosition";
import type { ReadingSettings } from "../lib/readingSettings";

const sessionStorageKey = "plainmark:session:v1";

export function useRestoredSession() {
  return useMemo(
    () => restoreSessionSnapshot(window.localStorage.getItem(sessionStorageKey)),
    []
  );
}

export function useSessionPersistence(
  workspace: MarkdownWorkspace,
  viewMode: PersistedViewMode,
  themeMode: PersistedThemeMode,
  readingSettings: ReadingSettings,
  readingPositions: ReadingPositions
): void {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const snapshot = createSessionSnapshot(workspace, viewMode, themeMode, readingSettings, readingPositions);
      try {
        window.localStorage.setItem(sessionStorageKey, JSON.stringify(snapshot));
      } catch {
        // Ignore storage failures so editing and saving keep working.
      }
    }, 400);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [workspace, viewMode, themeMode, readingSettings, readingPositions]);
}
