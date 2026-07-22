import { describe, expect, it } from "vitest";
import {
  isLocalMarkdownHref,
  resolveLocalAssetHref,
  resolveMarkdownHref
} from "./fileLinks";

describe("local Markdown links", () => {
  it("detects relative Markdown hrefs and ignores remote links", () => {
    expect(isLocalMarkdownHref("./chapter.md")).toBe(true);
    expect(isLocalMarkdownHref("../notes/intro.markdown#top")).toBe(true);
    expect(isLocalMarkdownHref("https://example.com/readme.md")).toBe(false);
    expect(isLocalMarkdownHref("#heading")).toBe(false);
  });

  it("resolves a relative Markdown href against the active document path", () => {
    expect(resolveMarkdownHref("/Users/me/docs/guide/readme.md", "../api/intro.md#install")).toEqual({
      anchor: "install",
      path: "/Users/me/docs/api/intro.md"
    });
  });

  it("resolves relative local assets to file URLs for preview", () => {
    expect(resolveLocalAssetHref("/Users/me/docs/guide/readme.md", "./images/a b.png")).toBe(
      "file:///Users/me/docs/guide/images/a%20b.png"
    );
  });
});
