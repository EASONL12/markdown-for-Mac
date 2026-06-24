import { describe, expect, it, vi } from "vitest";
import { createBrowserPreviewApi } from "./plainmarkApi";

describe("createBrowserPreviewApi", () => {
  it("returns null for open and save when Electron is unavailable", async () => {
    const api = createBrowserPreviewApi();

    await expect(api.openMarkdown()).resolves.toBeNull();
    await expect(api.saveMarkdown({ path: null, content: "# Draft" })).resolves.toBeNull();
    await expect(api.saveMarkdownAs({ path: "/tmp/draft.md", content: "# Draft" })).resolves.toBeNull();
  });

  it("returns unsubscribe functions for preview subscriptions", () => {
    const api = createBrowserPreviewApi();
    const callback = vi.fn();

    expect(api.onExternalFileOpen(callback)).toEqual(expect.any(Function));
    expect(api.onMenuOpen(callback)).toEqual(expect.any(Function));
    expect(api.onMenuSave(callback)).toEqual(expect.any(Function));
    expect(api.onMenuOpenRecent(callback)).toEqual(expect.any(Function));
  });
});
