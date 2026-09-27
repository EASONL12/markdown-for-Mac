import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const directory = path.dirname(fileURLToPath(import.meta.url));
const source = await fs.readFile(path.join(directory, "main.cjs"), "utf8");
let temporaryDirectory;

beforeEach(async () => {
  vi.useFakeTimers();
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "plainmark-save-test-"));
});
afterEach(async () => {
  vi.clearAllTimers();
  vi.useRealTimers();
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

function loadSaveHandler(selectedPath) {
  const handlers = new Map();
  const electron = {
    app: { setName() {}, on() {}, whenReady: () => ({ then() {} }) },
    nativeTheme: { on() {} },
    ipcMain: { on() {}, handle: (name, handler) => handlers.set(name, handler) },
    dialog: { showSaveDialog: async () => ({ canceled: !selectedPath, filePath: selectedPath }) }
  };
  vm.runInNewContext(source, {
    require: (name) => name === "electron" ? electron : require(name),
    __dirname: directory,
    setTimeout,
    clearTimeout,
    process
  });
  return (file) => handlers.get("markdown:save-as")({}, file);
}

describe("save-copy path protection in the main process", () => {
  it("rejects an excluded destination before touching the original file", async () => {
    const original = path.join(temporaryDirectory, "original.md");
    await fs.writeFile(original, "external version");
    const save = loadSaveHandler(original);
    await expect(save({ path: original, content: "local draft", excludedPaths: [original] })).rejects.toThrow("different path");
    expect(await fs.readFile(original, "utf8")).toBe("external version");
    expect(await fs.readdir(temporaryDirectory)).toEqual(["original.md"]);
  });

  it("writes an allowed copy while retaining the original", async () => {
    const original = path.join(temporaryDirectory, "original.md");
    const copy = path.join(temporaryDirectory, "copy.md");
    await fs.writeFile(original, "external version");
    const save = loadSaveHandler(copy);
    expect(await save({ path: original, content: "local draft", excludedPaths: [original] }))
      .toEqual({ path: path.join(await fs.realpath(temporaryDirectory), "copy.md"), content: "local draft" });
    expect(await fs.readFile(original, "utf8")).toBe("external version");
    expect(await fs.readFile(copy, "utf8")).toBe("local draft");
  });

  it("does not write anything when the dialog is canceled", async () => {
    const save = loadSaveHandler(null);
    expect(await save({ path: null, content: "draft" })).toBeNull();
    expect(await fs.readdir(temporaryDirectory)).toEqual([]);
  });
});


describe("canonical save identities", () => {
  it("returns the same identity when saving via a directory symlink", async () => {
    const realDirectory = path.join(temporaryDirectory, "real");
    const aliasDirectory = path.join(temporaryDirectory, "alias");
    await fs.mkdir(realDirectory);
    await fs.symlink(realDirectory, aliasDirectory);
    const destination = path.join(realDirectory, "b.md");
    await fs.writeFile(destination, "old disk B");
    const save = loadSaveHandler(path.join(aliasDirectory, "b.md"));
    const result = await save({ path: null, content: "A" });
    expect(result.path).toBe(await fs.realpath(destination));
    expect(await fs.readFile(destination, "utf8")).toBe("A");
  });

  it("cannot bypass copy protection using a symlink to the original", async () => {
    const original = path.join(temporaryDirectory, "original.md");
    const alias = path.join(temporaryDirectory, "alias.md");
    await fs.writeFile(original, "external version");
    await fs.symlink(original, alias);
    const save = loadSaveHandler(alias);
    await expect(save({ path: null, content: "draft", excludedPaths: [original] })).rejects.toThrow("different path");
    expect(await fs.readFile(original, "utf8")).toBe("external version");
    expect((await fs.lstat(alias)).isSymbolicLink()).toBe(true);
  });
});
