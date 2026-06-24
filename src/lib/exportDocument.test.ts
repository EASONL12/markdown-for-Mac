import { describe, expect, it } from "vitest";
import {
  buildConflictChoices,
  buildExportHtml,
  getConflictCopyPath,
  getDefaultExportPath,
  shouldAutoSaveDocument
} from "./exportDocument";

describe("exportDocument", () => {
  it("builds a standalone HTML document from rendered Markdown", () => {
    const html = buildExportHtml({
      bodyHtml: "<h1>Notes</h1><p>Hello</p>",
      sourcePath: "/Users/test/Notes.md",
      theme: "light"
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Notes</title>");
    expect(html).toContain("<main class=\"markdown-body\">");
    expect(html).toContain("<h1>Notes</h1><p>Hello</p>");
    expect(html).toContain("katex.min.css");
  });

  it("escapes the export title when building HTML", () => {
    const html = buildExportHtml({
      bodyHtml: "<p>Safe body</p>",
      sourcePath: "/tmp/A & B.md",
      theme: "dark"
    });

    expect(html).toContain("<title>A &amp; B</title>");
    expect(html).toContain("data-theme=\"dark\"");
  });

  it("derives default export paths from source paths", () => {
    expect(getDefaultExportPath("/tmp/notes.md", "html")).toBe("/tmp/notes.html");
    expect(getDefaultExportPath("/tmp/notes.markdown", "pdf")).toBe("/tmp/notes.pdf");
    expect(getDefaultExportPath(null, "html")).toBe("Untitled.html");
  });

  it("describes conflict choices for dirty and clean documents", () => {
    expect(buildConflictChoices(true).map((choice) => choice.action)).toEqual([
      "keep-local",
      "reload",
      "save-copy"
    ]);
    expect(buildConflictChoices(false).map((choice) => choice.action)).toEqual(["reload", "dismiss"]);
  });

  it("pauses autosave for the file with an unresolved conflict", () => {
    expect(shouldAutoSaveDocument("/tmp/notes.md", true, "/tmp/notes.md")).toBe(false);
    expect(shouldAutoSaveDocument("/tmp/other.md", true, "/tmp/notes.md")).toBe(true);
    expect(shouldAutoSaveDocument("/tmp/notes.md", false, "/tmp/notes.md")).toBe(false);
    expect(shouldAutoSaveDocument(null, true, "/tmp/notes.md")).toBe(false);
  });

  it("derives safe default paths for conflict save copies", () => {
    expect(getConflictCopyPath("/tmp/notes.md")).toBe("/tmp/notes.local-copy.md");
    expect(getConflictCopyPath("/tmp/notes.markdown")).toBe("/tmp/notes.local-copy.markdown");
    expect(getConflictCopyPath("/tmp/notes")).toBe("/tmp/notes.local-copy.md");
  });
});
