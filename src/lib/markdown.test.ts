import { describe, expect, it } from "vitest";
import { extractOutline, renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings, emphasis, lists, and code blocks", () => {
    const html = renderMarkdown("# Notes\n\n- **Write** first\n\n```js\nconsole.log('ok')\n```");

    expect(html).toContain('<h1 id="notes">Notes</h1>');
    expect(html).toContain("<strong>Write</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("language-js");
  });

  it("does not render raw HTML from a Markdown file", () => {
    const html = renderMarkdown("# Safe\n\n<script>alert('x')</script>");

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("extracts a document outline from Markdown headings outside code fences", () => {
    const outline = extractOutline(`# Title

## Section

\`\`\`md
# Not a heading
\`\`\`

### Detail
`);

    expect(outline).toEqual([
      { id: "title", level: 1, title: "Title" },
      { id: "section", level: 2, title: "Section" },
      { id: "detail", level: 3, title: "Detail" }
    ]);
  });

  it("renders headings with stable ids for outline navigation", () => {
    const html = renderMarkdown("# Same\n\n## Same\n\n# 中文标题");

    expect(html).toContain('<h1 id="same">Same</h1>');
    expect(html).toContain('<h2 id="same-2">Same</h2>');
    expect(html).toContain('<h1 id="中文标题">中文标题</h1>');
  });

  it("renders inline LaTeX formulas with KaTeX", () => {
    const html = renderMarkdown("Einstein wrote $E = mc^2$ in a note.");

    expect(html).toContain("katex");
    expect(html).toContain("E");
    expect(html).toContain("mord mathnormal");
    expect(html).toContain("msupsub");
  });

  it("renders block LaTeX formulas with KaTeX display mode", () => {
    const html = renderMarkdown("Before\n\n$$\na^2 + b^2 = c^2\n$$\n\nAfter");

    expect(html).toContain("katex-display");
    expect(html).toContain("a");
    expect(html).toContain("c");
  });

  it("does not render LaTeX formulas inside fenced code blocks", () => {
    const html = renderMarkdown("```md\n$E = mc^2$\n```");

    expect(html).not.toContain("katex");
    expect(html).toContain("$E = mc^2$");
  });
});
