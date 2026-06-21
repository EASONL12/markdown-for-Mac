import hljs from "highlight.js";
import katex from "katex";
import MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type Token from "markdown-it/lib/token.mjs";

const escapeHtml = MarkdownIt().utils.escapeHtml;

export interface OutlineItem {
  id: string;
  level: number;
  title: string;
}

function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "section";
}

function uniqueSlug(baseSlug: string, usedSlugs: Map<string, number>): string {
  const count = usedSlugs.get(baseSlug) ?? 0;
  usedSlugs.set(baseSlug, count + 1);
  return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
}

function headingTextFromInlineToken(token: Token | undefined): string {
  return token?.children?.map((child) => child.content).join("").trim() ?? "";
}

export function extractOutline(source: string): OutlineItem[] {
  const tokens = markdown.parse(source, {});
  return extractOutlineFromTokens(tokens);
}

function extractOutlineFromTokens(tokens: Token[]): OutlineItem[] {
  const usedSlugs = new Map<string, number>();
  const outline: OutlineItem[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open") {
      continue;
    }

    const level = Number(token.tag.slice(1));
    if (level < 1 || level > 6) {
      continue;
    }

    const title = headingTextFromInlineToken(tokens[index + 1]);
    if (!title) {
      continue;
    }

    outline.push({
      id: uniqueSlug(slugify(title), usedSlugs),
      level,
      title
    });
  }

  return outline;
}

function addHeadingIds(tokens: Token[]): void {
  const outline = extractOutlineFromTokens(tokens);
  let headingIndex = 0;

  for (const token of tokens) {
    if (token.type !== "heading_open") {
      continue;
    }

    const outlineItem = outline[headingIndex];
    headingIndex += 1;
    if (outlineItem) {
      token.attrSet("id", outlineItem.id);
    }
  }
}

function renderMath(source: string, displayMode: boolean): string {
  return katex.renderToString(source, {
    displayMode,
    output: "html",
    throwOnError: false,
    trust: false
  });
}

function findClosingInlineDollar(source: string, start: number): number {
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "$" && source[index - 1] !== "\\") {
      return index;
    }
  }

  return -1;
}

function inlineMathRule(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== "$" || state.src[state.pos + 1] === "$") {
    return false;
  }

  const end = findClosingInlineDollar(state.src, state.pos + 1);
  if (end === -1) {
    return false;
  }

  const content = state.src.slice(state.pos + 1, end).trim();
  if (!content) {
    return false;
  }

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = content;
    token.markup = "$";
  }

  state.pos = end + 1;
  return true;
}

function blockMathRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const firstLine = state.src.slice(start, max).trim();

  if (!firstLine.startsWith("$$")) {
    return false;
  }

  const firstLineContent = firstLine.slice(2).trim();
  const collected: string[] = [];
  let nextLine = startLine;

  if (firstLineContent.endsWith("$$") && firstLineContent.length > 2) {
    collected.push(firstLineContent.slice(0, -2).trim());
  } else {
    if (firstLineContent) {
      collected.push(firstLineContent);
    }

    for (nextLine = startLine + 1; nextLine < endLine; nextLine += 1) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineEnd = state.eMarks[nextLine];
      const line = state.src.slice(lineStart, lineEnd);
      const closingIndex = line.indexOf("$$");

      if (closingIndex >= 0) {
        collected.push(line.slice(0, closingIndex).trimEnd());
        break;
      }

      collected.push(line);
    }

    if (nextLine >= endLine) {
      return false;
    }
  }

  const content = collected.join("\n").trim();
  if (!content) {
    return false;
  }

  if (!silent) {
    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = content;
    token.markup = "$$";
    token.map = [startLine, nextLine + 1];
  }

  state.line = nextLine + 1;
  return true;
}

const markdown: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code: string, language: string): string {
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code class="language-${language}">${hljs.highlight(code, {
          language,
          ignoreIllegals: true
        }).value}</code></pre>`;
      } catch {
        return "";
      }
    }

    return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
  }
});

markdown.inline.ruler.before("escape", "math_inline", inlineMathRule);
markdown.block.ruler.before("fence", "math_block", blockMathRule, {
  alt: ["paragraph", "reference", "blockquote", "list"]
});
markdown.renderer.rules.math_inline = (tokens, index): string => renderMath(tokens[index].content, false);
markdown.renderer.rules.math_block = (tokens, index): string => `${renderMath(tokens[index].content, true)}\n`;

export function renderMarkdown(source: string): string {
  const env = {};
  const tokens = markdown.parse(source, env);
  addHeadingIds(tokens);

  for (const token of tokens) {
    if (token.map && token.level === 0) {
      token.attrSet("data-source-line", String(token.map[0]));
    }
  }

  return markdown.renderer.render(tokens, markdown.options, env);
}
