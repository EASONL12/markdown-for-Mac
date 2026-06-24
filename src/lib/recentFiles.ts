export interface RecentFile {
  path: string;
  openedAt: number;
}

const maxRecentFiles = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecentFile(value: unknown): value is RecentFile {
  return isRecord(value) && typeof value.path === "string" && value.path.length > 0 && typeof value.openedAt === "number";
}

export function restoreRecentFiles(serialized: string | null): RecentFile[] {
  if (!serialized) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecentFile)
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, maxRecentFiles);
  } catch {
    return [];
  }
}

export function addRecentFiles(existing: RecentFile[], paths: string[], now = Date.now()): RecentFile[] {
  const byPath = new Map(existing.map((file) => [file.path, file]));

  paths.forEach((path, index) => {
    if (!path) return;
    byPath.set(path, { path, openedAt: now + index });
  });

  return [...byPath.values()]
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, maxRecentFiles);
}

export function removeRecentFile(existing: RecentFile[], path: string): RecentFile[] {
  return existing.filter((file) => file.path !== path);
}

export function getRecentDisplayName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}
