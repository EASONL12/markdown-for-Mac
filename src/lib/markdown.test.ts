import { describe, expect, it } from "vitest";
import { extractOutline, renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings, emphasis, lists, and code blocks", () => {
    const html = renderMarkdown("# Notes\n\n- **Write** first\n\n```js\nconsole.log('ok')\n```");

    expect(html).toContain('id="notes"');
    expect(html).toContain("Notes</h1>");
    expect(html).toContain("<strong>Write</strong>");
    expect(html).toContain("<ul");
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

    expect(html).toContain('id="same"');
    expect(html).toContain("Same</h1>");
    expect(html).toContain('id="same-2"');
    expect(html).toContain("Same</h2>");
    expect(html).toContain('id="中文标题"');
    expect(html).toContain("中文标题</h1>");
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

  it("renders $begin:math:inline$...$end:math:inline$ syntax", () => {
    const html = renderMarkdown("Energy is $begin:math:inline$E = mc^2$end:math:inline$ here.");

    expect(html).toContain("katex");
    expect(html).toContain("E");
  });

  it("renders $begin:math:text$...$end:math:text$ syntax as inline math", () => {
    const html = renderMarkdown("| 符号 | 含义 |\n|---|---|\n| $begin:math:text$f\\_\\{clk\\}$end:math:text$ | 时钟频率 |");

    expect(html).toContain("katex");
    expect(html).not.toContain("$begin:math:text$");
    expect(html).toContain("msupsub");
  });

  it("renders $begin:math:display$...$end:math:display$ syntax", () => {
    const html = renderMarkdown("$begin:math:display$\nS = \\frac{T_{before}}{T_{after}}\n$end:math:display$");

    expect(html).toContain("katex-display");
    expect(html).toContain("S");
  });

  it("renders escaped decimal and minus characters in math display blocks", () => {
    const html = renderMarkdown(`$begin:math:display$
CPI\\=0\\.5+0\\.4+0\\.3+0\\.4\\=1\\.6
$end:math:display$

$begin:math:display$
S\\_\\{max\\}
\\=
\\\\frac1\\{1\\-0\\.6\\}
\\= 2\\.5
$end:math:display$`);

    expect(html).toContain("katex-display");
    expect(html).not.toContain("katex-error");
    expect(html).toContain("1.6");
    expect(html).toContain("2.5");
    expect(html).toContain("msupsub");
  });

  it("renders escaped parentheses in math display blocks", () => {
    const html = renderMarkdown(`$begin:math:display$
CPI
\\=
\\\\sum
\\\\left\\(
\\\\frac\\{IC\\_i\\}\\{IC\\}
\\\\times
CPI\\_i
\\\\right\\)
$end:math:display$

$begin:math:display$
S
\\=
\\\\frac1
\\{
\\(1\\-f\\)
\\+
\\\\frac fP
\\}
$end:math:display$`);

    expect(html).toContain("katex-display");
    expect(html).not.toContain("katex-error");
    expect(html).toContain("∑");
    expect(html).toContain("×");
    expect(html).toContain("mfrac");
  });
});
