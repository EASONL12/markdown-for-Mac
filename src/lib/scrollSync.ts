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
