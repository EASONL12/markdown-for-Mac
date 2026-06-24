import { useEffect, useMemo } from "react";
import type { MarkdownWorkspace } from "../lib/documentModel";
import {
  createSessionSnapshot,
  restoreSessionSnapshot,
  type PersistedThemeMode,
  type PersistedViewMode
} from "../lib/session";

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
  themeMode: PersistedThemeMode
): void {
  useEffect(() => {
    const snapshot = createSessionSnapshot(workspace, viewMode, themeMode);
    try {
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures so editing and saving keep working.
    }
  }, [workspace, viewMode, themeMode]);
}
