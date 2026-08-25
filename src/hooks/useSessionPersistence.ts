import { useEffect, useMemo, useRef } from "react";
import type { MarkdownWorkspace } from "../lib/documentModel";
import {
  createSessionDocumentsPayload,
  createSessionPreferencesPayload,
  restoreSessionSnapshot,
  restoreSplitSession,
  type PlainMarkSessionSnapshot,
  type PersistedThemeMode,
  type PersistedViewMode
} from "../lib/session";
import {
  limitReadingPositions,
  type ReadingPositions
} from "../lib/readingPosition";
import type { ReadingSettings } from "../lib/readingSettings";

// Documents and preferences are persisted under separate keys so scrolling
// (which only moves reading positions) never re-serializes document contents.
const sessionDocsKey = "plainmark:session:v2:docs";
const sessionPrefsKey = "plainmark:session:v2:prefs";
// Pre-split single-blob key; read for migration, removed after the first
// successful split-format write.
const legacySessionKey = "plainmark:session:v1";
const maxReadingPositions = 50;
const quotaFallbackReadingPositions = 10;

export function useRestoredSession() {
  return useMemo(
    () => {
      const restored = restoreSplitSession(
        window.localStorage.getItem(sessionDocsKey),
        window.localStorage.getItem(sessionPrefsKey)
      );
      if (restored) return restored;
      return restoreSessionSnapshot(window.localStorage.getItem(legacySessionKey));
    },
    []
  );
}

function persistWithQuotaFallback(key: string, serialize: () => string, retrySerialize?: () => string): boolean {
  try {
    window.localStorage.setItem(key, serialize());
    return true;
  } catch {
    if (!retrySerialize) {
      // Nothing sensible to trim for documents; keep editing working.
      return false;
    }
    try {
      window.localStorage.setItem(key, retrySerialize());
      return true;
    } catch {
      return false;
    }
  }
}

export function useSessionPersistence(
  workspace: MarkdownWorkspace,
  viewMode: PersistedViewMode,
  themeMode: PersistedThemeMode,
  readingSettings: ReadingSettings,
  readingPositions: ReadingPositions
): void {
  const docsTimerRef = useRef<number | null>(null);
  const prefsTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (docsTimerRef.current !== null) {
      window.clearTimeout(docsTimerRef.current);
    }

    docsTimerRef.current = window.setTimeout(() => {
      docsTimerRef.current = null;
      const saved = persistWithQuotaFallback(
        sessionDocsKey,
        () => createSessionDocumentsPayload(workspace)
      );
      if (saved) {
        try {
          window.localStorage.removeItem(legacySessionKey);
        } catch {
          // Ignore storage failures so editing and saving keep working.
        }
      }
    }, 400);

    return () => {
      if (docsTimerRef.current !== null) {
        window.clearTimeout(docsTimerRef.current);
        docsTimerRef.current = null;
      }
    };
  }, [workspace]);

  useEffect(() => {
    if (prefsTimerRef.current !== null) {
      window.clearTimeout(prefsTimerRef.current);
    }

    prefsTimerRef.current = window.setTimeout(() => {
      prefsTimerRef.current = null;
      const buildPrefs = (positions: ReadingPositions) => () =>
        createSessionPreferencesPayload({
          readingPositions: positions,
          readingSettings,
          themeMode,
          viewMode
        });
      persistWithQuotaFallback(
        sessionPrefsKey,
        buildPrefs(limitReadingPositions(readingPositions, maxReadingPositions)),
        buildPrefs(limitReadingPositions(readingPositions, quotaFallbackReadingPositions))
      );
    }, 400);

    return () => {
      if (prefsTimerRef.current !== null) {
        window.clearTimeout(prefsTimerRef.current);
        prefsTimerRef.current = null;
      }
    };
  }, [viewMode, themeMode, readingSettings, readingPositions]);
}
