// Groups per-file watches so each directory hosts a single OS watcher instead
// of one per file. The public API stays keyed by file path; inside, a
// directory entry fans events out to every tracked basename it contains.
//
// `fs` is injected so tests can substitute a stub and assert how many
// underlying watchers were created.
module.exports = class WatcherRegistry {
  constructor({ fs, path, debounceMs = 50, onTrigger }) {
    this.fs = fs;
    this.path = path;
    this.debounceMs = debounceMs;
    this.onTrigger = onTrigger;
    /** @type {Map<string, {paths: Map<string, string>, timers: Map<string, any>, watcher: any}>} */
    this.directories = new Map();
  }

  watch(filePath) {
    const directory = this.path.dirname(filePath);
    const basename = this.path.basename(filePath);

    let entry = this.directories.get(directory);
    if (!entry) {
      entry = { paths: new Map(), timers: new Map(), watcher: null };
      try {
        entry.watcher = this.fs.watch(directory, (_event, filename) => {
          // filename can be null on some platforms; treat that as a possible
          // hit for every tracked file — content comparison downstream
          // filters false positives.
          const candidates =
            filename === null || filename === undefined
              ? [...entry.paths.keys()]
              : entry.paths.has(filename)
                ? [filename]
                : [];
          for (const candidate of candidates) {
            this.scheduleNotification(entry, candidate);
          }
        });
      } catch {
        // Directory may not exist yet, ignore.
        return;
      }
      this.directories.set(directory, entry);
    }

    entry.paths.set(basename, filePath);
  }

  scheduleNotification(entry, basename) {
    const existingTimer = entry.timers.get(basename);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      entry.timers.delete(basename);
      this.onTrigger(entry.paths.get(basename));
    }, this.debounceMs);
    entry.timers.set(basename, timer);
  }

  unwatch(filePath) {
    const directory = this.path.dirname(filePath);
    const basename = this.path.basename(filePath);
    const entry = this.directories.get(directory);
    if (!entry) return;

    entry.paths.delete(basename);
    const timer = entry.timers.get(basename);
    if (timer !== undefined) {
      clearTimeout(timer);
      entry.timers.delete(basename);
    }
    if (entry.paths.size === 0) {
      entry.watcher?.close?.();
      this.directories.delete(directory);
    }
  }

  dispose() {
    for (const entry of this.directories.values()) {
      for (const timer of entry.timers.values()) {
        clearTimeout(timer);
      }
      entry.watcher?.close?.();
    }
    this.directories.clear();
  }
};
