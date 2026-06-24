export interface SourceScrollAnchor {
  line: number;
  scrollTop: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sortedAnchors(anchors: SourceScrollAnchor[]): SourceScrollAnchor[] {
  return [...anchors].sort((a, b) => a.line - b.line || a.scrollTop - b.scrollTop);
}

export function findPreviewScrollTop(
  textareaScrollTop: number,
  textareaScrollHeight: number,
  textareaClientHeight: number,
  previewScrollHeight: number,
  previewClientHeight: number
): number {
  const textareaMax = textareaScrollHeight - textareaClientHeight;
  if (textareaMax <= 0) return 0;
  const fraction = textareaScrollTop / textareaMax;
  const previewMax = previewScrollHeight - previewClientHeight;
  return fraction * previewMax;
}

export function findTextareaScrollTop(
  previewScrollTop: number,
  previewScrollHeight: number,
  previewClientHeight: number,
  textareaScrollHeight: number,
  textareaClientHeight: number
): number {
  const previewMax = previewScrollHeight - previewClientHeight;
  if (previewMax <= 0) return 0;
  const fraction = previewScrollTop / previewMax;
  const textareaMax = textareaScrollHeight - textareaClientHeight;
  return fraction * textareaMax;
}

export function findPreviewScrollTopForSourceLine(
  sourceLine: number,
  anchors: SourceScrollAnchor[],
  maxScrollTop: number
): number | null {
  if (anchors.length === 0) return null;

  const ordered = sortedAnchors(anchors);
  const first = ordered[0];
  if (sourceLine <= first.line) {
    return clamp(first.scrollTop, 0, maxScrollTop);
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const next = ordered[index];
    if (sourceLine > next.line) {
      continue;
    }

    if (next.line === previous.line) {
      return clamp(previous.scrollTop, 0, maxScrollTop);
    }

    const fraction = (sourceLine - previous.line) / (next.line - previous.line);
    return clamp(previous.scrollTop + fraction * (next.scrollTop - previous.scrollTop), 0, maxScrollTop);
  }

  return clamp(ordered[ordered.length - 1].scrollTop, 0, maxScrollTop);
}

export function findSourceLineForPreviewScrollTop(
  previewScrollTop: number,
  anchors: SourceScrollAnchor[],
  maxSourceLine: number
): number | null {
  if (anchors.length === 0) return null;

  const ordered = sortedAnchors(anchors);
  const first = ordered[0];
  if (previewScrollTop <= first.scrollTop) {
    return clamp(first.line, 0, maxSourceLine);
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const next = ordered[index];
    if (previewScrollTop > next.scrollTop) {
      continue;
    }

    if (next.scrollTop === previous.scrollTop) {
      return clamp(previous.line, 0, maxSourceLine);
    }

    const fraction = (previewScrollTop - previous.scrollTop) / (next.scrollTop - previous.scrollTop);
    return Math.round(clamp(previous.line + fraction * (next.line - previous.line), 0, maxSourceLine));
  }

  return clamp(ordered[ordered.length - 1].line, 0, maxSourceLine);
}

export function findTextareaSourceLine(
  textareaScrollTop: number,
  lineHeight: number,
  totalLines: number
): number {
  if (lineHeight <= 0 || totalLines <= 0) return 0;
  return clamp(Math.floor(textareaScrollTop / lineHeight), 0, totalLines - 1);
}

export function findTextareaScrollTopForSourceLine(
  sourceLine: number,
  lineHeight: number,
  maxScrollTop: number
): number {
  if (lineHeight <= 0) return 0;
  return clamp(sourceLine * lineHeight, 0, maxScrollTop);
}
