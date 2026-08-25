export interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
}

export interface SearchResult {
  count: number;
  indices: number[];
  matchLengths: number[];
}

const maxMatches = 10000;

function escapePlainText(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Outside regex mode the replacement must land verbatim, so neutralize the
// $ sequences ("$&", "$1", ...) that String#replace would otherwise expand.
function prepareReplacement(replacement: string, options: SearchOptions): string {
  return options.useRegex ? replacement : replacement.replace(/\$/g, "$$$$");
}

function createRegExp(query: string, options: SearchOptions, sticky: boolean): RegExp | null {
  const source = options.useRegex ? query : escapePlainText(query);
  const flags = `${options.caseSensitive ? "" : "i"}${sticky ? "y" : "g"}`;
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

export function findAll(source: string, query: string, options: SearchOptions): SearchResult {
  if (!query) return { count: 0, indices: [], matchLengths: [] };

  const indices: number[] = [];
  const matchLengths: number[] = [];

  if (options.useRegex) {
    const regex = createRegExp(query, options, false);
    if (!regex) {
      return { count: 0, indices: [], matchLengths: [] };
    }
    try {
      let match;
      while ((match = regex.exec(source)) !== null) {
        indices.push(match.index);
        matchLengths.push(match[0].length);
        if (indices.length > maxMatches) break;
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } catch {
      return { count: 0, indices: [], matchLengths: [] };
    }
  } else {
    const text = options.caseSensitive ? source : source.toLowerCase();
    const search = options.caseSensitive ? query : query.toLowerCase();
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(search, pos);
      if (idx === -1) break;
      indices.push(idx);
      matchLengths.push(search.length);
      pos = idx + 1;
      if (indices.length > maxMatches) break;
    }
  }

  return { count: indices.length, indices, matchLengths };
}

export function findNextMatchAfterReplace(
  originalContent: string,
  start: number,
  matchLength: number,
  query: string,
  replacement: string,
  options: SearchOptions
): { content: string; nextIndex: number } {
  // A sticky regex replaces exactly the match at `start` and expands $1/$&
  // the same way Replace All does, keeping both replace paths consistent.
  const pattern = createRegExp(query, options, true);
  if (!pattern || start < 0 || start + matchLength > originalContent.length) {
    return { content: originalContent, nextIndex: 0 };
  }

  // Run against the complete source so lookbehind and other left-context
  // assertions still see the characters before the selected match.
  pattern.lastIndex = start;
  const match = pattern.exec(originalContent);
  if (!match || match.index !== start || match[0].length !== matchLength) {
    return { content: originalContent, nextIndex: 0 };
  }

  pattern.lastIndex = start;
  const content = originalContent.replace(pattern, prepareReplacement(replacement, options));
  const replacedLength = Math.max(0, content.length - (originalContent.length - matchLength));

  const nextResult = findAll(content, query, options);
  const nextIndex = nextResult.indices.findIndex((index) => index >= start + replacedLength);
  return { content, nextIndex: nextIndex === -1 ? 0 : nextIndex };
}

export function replaceAll(
  source: string,
  query: string,
  replacement: string,
  options: SearchOptions
): string {
  if (!query) return source;

  const regex = createRegExp(query, options, false);
  if (!regex) return source;

  return source.replace(regex, prepareReplacement(replacement, options));
}
