import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addRecentFiles,
  getRecentDisplayName,
  removeRecentFile,
  restoreRecentFiles
} from "../lib/recentFiles";

const recentFilesStorageKey = "plainmark:recent-files:v1";

export function useRecentFiles() {
  const restoredRecentFiles = useMemo(
    () => restoreRecentFiles(window.localStorage.getItem(recentFilesStorageKey)),
    []
  );
  const [recentFiles, setRecentFiles] = useState(() => restoredRecentFiles);
  const [recentSearch, setRecentSearch] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(recentFilesStorageKey, JSON.stringify(recentFiles));
    } catch {
      // Ignore storage failures so file operations keep working.
    }
  }, [recentFiles]);

  const rememberRecentPaths = useCallback((paths: string[]) => {
    const trackablePaths = paths.filter((path) => path.includes("/") || path.includes("\\"));
    if (trackablePaths.length === 0) return;
    setRecentFiles((current) => addRecentFiles(current, trackablePaths));
  }, []);

  const removeRecentPath = useCallback((path: string) => {
    setRecentFiles((current) => removeRecentFile(current, path));
  }, []);

  const filteredRecentFiles = useMemo(() => {
    const query = recentSearch.trim().toLowerCase();
    if (!query) return recentFiles;
    return recentFiles.filter((file) => {
      const name = getRecentDisplayName(file.path).toLowerCase();
      return name.includes(query) || file.path.toLowerCase().includes(query);
    });
  }, [recentFiles, recentSearch]);

  return {
    filteredRecentFiles,
    recentSearch,
    rememberRecentPaths,
    removeRecentPath,
    setRecentSearch
  };
}
