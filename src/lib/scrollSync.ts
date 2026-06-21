export interface LineOffset {
  line: number;
  top: number;
}

export function buildLineOffsetMap(previewEl: HTMLElement): Map<number, number> {
  const map = new Map<number, number>();
  const elements = previewEl.querySelectorAll<HTMLElement>("[data-source-line]");

  for (const el of elements) {
    const line = parseInt(el.dataset.sourceLine ?? "", 10);
    if (!isNaN(line) && !map.has(line)) {
      map.set(line, el.offsetTop);
    }
  }

  return map;
}

export function findPreviewScrollTop(
  textareaScrollTop: number,
  textareaScrollHeight: number,
  textareaClientHeight: number,
  lineOffsets: Map<number, number>,
  previewScrollHeight: number,
  previewClientHeight: number
): number {
  if (lineOffsets.size === 0) return 0;

  const scrollFraction = textareaScrollTop / Math.max(textareaScrollHeight - textareaClientHeight, 1);
  const lines = Array.from(lineOffsets.keys()).sort((a, b) => a - b);
  const maxLine = lines[lines.length - 1] ?? 0;
  const targetLine = scrollFraction * maxLine;

  let closestOffset = 0;
  let minDist = Infinity;
  for (const [line, offset] of lineOffsets) {
    const dist = Math.abs(line - targetLine);
    if (dist < minDist) {
      minDist = dist;
      closestOffset = offset;
    }
  }

  const maxOffset = Math.max(...lineOffsets.values(), 1);
  const maxScroll = previewScrollHeight - previewClientHeight;
  return (closestOffset / maxOffset) * maxScroll;
}

export function findTextareaScrollTop(
  previewScrollTop: number,
  previewScrollHeight: number,
  previewClientHeight: number,
  lineOffsets: Map<number, number>,
  textareaScrollHeight: number,
  textareaClientHeight: number
): number {
  if (lineOffsets.size === 0) return 0;

  const scrollFraction = previewScrollTop / Math.max(previewScrollHeight - previewClientHeight, 1);
  const lines = Array.from(lineOffsets.keys()).sort((a, b) => a - b);
  const maxLine = lines[lines.length - 1] ?? 0;
  if (maxLine === 0) return 0;
  const targetLine = scrollFraction * maxLine;

  const maxScroll = textareaScrollHeight - textareaClientHeight;
  return (targetLine / maxLine) * maxScroll;
}
