export interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
}

export interface SearchResult {
  count: number;
  indices: number[];
}

export function findAll(source: string, query: string, options: SearchOptions): SearchResult {
  if (!query) return { count: 0, indices: [] };

  const indices: number[] = [];

  if (options.useRegex) {
    try {
      const flags = options.caseSensitive ? "g" : "gi";
      const regex = new RegExp(query, flags);
      let match;
      while ((match = regex.exec(source)) !== null) {
        indices.push(match.index);
        if (indices.length > 10000) break;
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } catch {
      return { count: 0, indices: [] };
    }
  } else {
    const text = options.caseSensitive ? source : source.toLowerCase();
    const search = options.caseSensitive ? query : query.toLowerCase();
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(search, pos);
      if (idx === -1) break;
      indices.push(idx);
      pos = idx + 1;
      if (indices.length > 10000) break;
    }
  }

  return { count: indices.length, indices };
}

export function replaceAll(
  source: string,
  query: string,
  replacement: string,
  options: SearchOptions
): string {
  if (!query) return source;

  if (options.useRegex) {
    try {
      const flags = options.caseSensitive ? "g" : "gi";
      return source.replace(new RegExp(query, flags), replacement);
    } catch {
      return source;
    }
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flags = options.caseSensitive ? "g" : "gi";
  return source.replace(new RegExp(escaped, flags), replacement);
}
