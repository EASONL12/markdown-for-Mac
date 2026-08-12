import { useEffect } from "react";

const supportedDropFilePattern = /\.(md|markdown|mdown|mkd|txt)$/i;

export function useDocumentDrop(onOpenDroppedFiles: (files: { path: string; content: string }[]) => void) {
  useEffect(() => {
    const prevent = (event: DragEvent) => { event.preventDefault(); };
    const handleDrop = async (event: DragEvent) => {
      event.preventDefault();
      if (!event.dataTransfer) return;
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        supportedDropFilePattern.test(file.name)
      );
      if (files.length === 0) return;
      const results = await Promise.all(
        files.map(async (file) => {
          const text = await file.text();
          const path = window.plainmark?.getPathForFile?.(file) || file.name;
          return { path, content: text };
        })
      );
      onOpenDroppedFiles(results);
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onOpenDroppedFiles]);
}

