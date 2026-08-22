import { describe, expect, it, vi } from "vitest";
import WatcherRegistry from "./watcherRegistry.cjs";

// Minimal path stub shaped like node:path for the simple absolute paths used here.
const fakePath = {
  dirname: (p) => p.split("/").slice(0, -1).join("/"),
  basename: (p) => p.split("/").pop()
};

function createFakeFs() {
  const watchers = [];
  return {
    watchers,
    watch(directory, handler) {
      const watcher = { directory, handler, close: vi.fn() };
      watchers.push(watcher);
      return watcher;
    }
  };
}

function createRegistry(fsStub, onTrigger, debounceMs = 20) {
  return new WatcherRegistry({ fs: fsStub, path: fakePath, debounceMs, onTrigger });
}

function emit(watcher, filename) {
  watcher.handler("rename", filename);
}

describe("WatcherRegistry", () => {
  it("creates one underlying watcher per directory for multiple files", () => {
    const fsStub = createFakeFs();
    const registry = createRegistry(fsStub, vi.fn());

    registry.watch("/docs/a.md");
    registry.watch("/docs/b.md");
    registry.watch("/docs/c.md");
    registry.watch("/other/d.md");

    expect(fsStub.watchers).toHaveLength(2);
    expect(fsStub.watchers.filter((w) => w.directory === "/docs")).toHaveLength(1);
  });

  it("routes an event to the tracked file with its original path", async () => {
    const fsStub = createFakeFs();
    const onTrigger = vi.fn();
    const registry = createRegistry(fsStub, onTrigger);
    registry.watch("/docs/a.md");

    emit(fsStub.watchers[0], "a.md");

    await vi.waitFor(() => expect(onTrigger).toHaveBeenCalledWith("/docs/a.md"), { timeout: 1000 });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("does not trigger for untracked basenames in the same directory", async () => {
    const fsStub = createFakeFs();
    const onTrigger = vi.fn();
    const registry = createRegistry(fsStub, onTrigger);
    registry.watch("/docs/a.md");

    emit(fsStub.watchers[0], "other.md");

    // Wait past the debounce window to prove nothing fires.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("fans a null-filename event out to every tracked file in the directory", async () => {
    const fsStub = createFakeFs();
    const onTrigger = vi.fn();
    const registry = createRegistry(fsStub, onTrigger);
    registry.watch("/docs/a.md");
    registry.watch("/docs/b.md");

    emit(fsStub.watchers[0], null);

    await vi.waitFor(
      () => {
        expect(onTrigger).toHaveBeenCalledWith("/docs/a.md");
        expect(onTrigger).toHaveBeenCalledWith("/docs/b.md");
      },
      { timeout: 1000 }
    );
  });

  it("debounces rapid events for the same file into one trigger", async () => {
    const fsStub = createFakeFs();
    const onTrigger = vi.fn();
    const registry = createRegistry(fsStub, onTrigger, 30);
    registry.watch("/docs/a.md");
    const watcher = fsStub.watchers[0];

    for (let i = 0; i < 6; i += 1) {
      emit(watcher, "a.md");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("closes the underlying watcher when the last file in a directory is unwatched", () => {
    const fsStub = createFakeFs();
    const registry = createRegistry(fsStub, vi.fn());
    registry.watch("/docs/a.md");
    registry.watch("/docs/b.md");

    registry.unwatch("/docs/a.md");
    expect(fsStub.watchers[0].close).not.toHaveBeenCalled();

    registry.unwatch("/docs/b.md");
    expect(fsStub.watchers[0].close).toHaveBeenCalledTimes(1);

    // Unwatching an unknown path is a safe no-op.
    registry.unwatch("/docs/b.md");
  });

  it("dispose closes everything and clears state", () => {
    const fsStub = createFakeFs();
    const registry = createRegistry(fsStub, vi.fn());
    registry.watch("/docs/a.md");
    registry.watch("/other/b.md");

    registry.dispose();

    expect(fsStub.watchers.every((w) => w.close.mock.calls.length === 1)).toBe(true);
  });
});
