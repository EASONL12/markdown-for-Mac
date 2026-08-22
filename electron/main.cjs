const { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } = require("electron");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

let mainWindow = null;
let rendererReady = false;
let pendingExternalPaths = [];
let hasDirtyDocuments = false;
let closeConfirmed = false;
const fileWatchers = new Map();
const internalWrites = new Map();
const internalWriteLifetimeMs = 1500;

function isMarkdownPath(filePath) {
  return [".md", ".markdown", ".mdown", ".mkd"].includes(path.extname(filePath).toLowerCase());
}

async function readMarkdownFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return { path: filePath, content };
}

async function openExternalFile(filePath) {
  if (!isMarkdownPath(filePath)) {
    return;
  }

  if (!mainWindow || !rendererReady) {
    if (!pendingExternalPaths.includes(filePath)) {
      pendingExternalPaths.push(filePath);
    }
    return;
  }

  const file = await readMarkdownFile(filePath);
  mainWindow.webContents.send("markdown:external-open", file);
}

function watchFile(filePath) {
  if (fileWatchers.has(filePath)) return;

  // Watch the parent directory instead of the file itself: the app writes via
  // a temp file + rename, which replaces the inode a file watcher is bound to.
  // A directory watcher keeps working across those atomic saves.
  try {
    let notificationTimer = null;
    const directory = path.dirname(filePath);
    const basename = path.basename(filePath);
    const watcher = fsSync.watch(directory, (_event, filename) => {
      if (filename && filename !== basename) return;
      if (notificationTimer !== null) {
        clearTimeout(notificationTimer);
      }
      // Give an atomic rename time to settle before comparing the resulting
      // file with writes initiated by this app.
      notificationTimer = setTimeout(async () => {
        notificationTimer = null;
        const matchingWrites = (internalWrites.get(filePath) ?? [])
          .filter((write) => write.expiresAt >= Date.now());
        if (matchingWrites.length > 0) {
          internalWrites.set(filePath, matchingWrites);
          try {
            const content = await fs.readFile(filePath, "utf8");
            if (matchingWrites.some((write) => content === write.content)) {
              return;
            }
          } catch {
            // Let the renderer handle a file that disappeared after saving.
          }
        } else {
          internalWrites.delete(filePath);
        }

        if (mainWindow && rendererReady) {
          mainWindow.webContents.send("file:modified", filePath);
        }
      }, 50);
    });
    fileWatchers.set(filePath, {
      close() {
        if (notificationTimer !== null) {
          clearTimeout(notificationTimer);
        }
        watcher.close();
      }
    });
  } catch {
    // Directory may not exist yet, ignore
  }
}

function unwatchFile(filePath) {
  const watcher = fileWatchers.get(filePath);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(filePath);
  }
}

async function writeMarkdownFile(file, forceDialog = false) {
  let targetPath = forceDialog ? null : file.path;

  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: forceDialog ? "Save Markdown As" : "Save Markdown",
      defaultPath: file.path || "Untitled.md",
      filters: [{ name: "Markdown", extensions: ["md"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    targetPath = result.filePath;
  }

  const tmpPath = targetPath + "." + crypto.randomBytes(8).toString("hex") + ".tmp";
  const internalWrite = {
    content: file.content,
    expiresAt: Date.now() + internalWriteLifetimeMs
  };
  internalWrites.set(targetPath, [...(internalWrites.get(targetPath) ?? []), internalWrite]);
  setTimeout(() => {
    const remainingWrites = (internalWrites.get(targetPath) ?? [])
      .filter((write) => write !== internalWrite && write.expiresAt >= Date.now());
    if (remainingWrites.length === 0) {
      internalWrites.delete(targetPath);
    } else {
      internalWrites.set(targetPath, remainingWrites);
    }
  }, internalWriteLifetimeMs);
  try {
    await fs.writeFile(tmpPath, file.content, "utf8");
    await fs.rename(tmpPath, targetPath);
  } catch (error) {
    const remainingWrites = (internalWrites.get(targetPath) ?? [])
      .filter((write) => write !== internalWrite);
    if (remainingWrites.length === 0) {
      internalWrites.delete(targetPath);
    } else {
      internalWrites.set(targetPath, remainingWrites);
    }
    throw error;
  }
  return { path: targetPath, content: file.content };
}

async function pickExportPath(defaultPath, title, extension) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
}

async function exportHtmlFile(file) {
  const targetPath = await pickExportPath(file.defaultPath, "Export HTML", "html");
  if (!targetPath) {
    return null;
  }

  await fs.writeFile(targetPath, file.html, "utf8");
  return targetPath;
}

async function exportPdfFile(file) {
  const targetPath = await pickExportPath(file.defaultPath, "Export PDF", "pdf");
  if (!targetPath) {
    return null;
  }

  // A data: URL page has an opaque origin and cannot load file:// images, so
  // stage the HTML in a temp file where local images resolve normally.
  const tempPath = path.join(
    app.getPath("temp"),
    "plainmark-print-" + crypto.randomBytes(8).toString("hex") + ".html"
  );
  await fs.writeFile(tempPath, file.html, "utf8");

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    await pdfWindow.loadFile(tempPath);
    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4"
    });
    await fs.writeFile(targetPath, pdfData);
    return targetPath;
  } finally {
    pdfWindow.close();
    fs.unlink(tempPath).catch(() => {});
  }
}

function createMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        }]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("menu:new")
        },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("menu:open")
        },
        {
          label: "Open Recent...",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => mainWindow?.webContents.send("menu:open-recent")
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("menu:save")
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow?.webContents.send("menu:save-as")
        },
        { type: "separator" },
        {
          label: "Export HTML...",
          click: () => mainWindow?.webContents.send("menu:export-html")
        },
        {
          label: "Export PDF...",
          click: () => mainWindow?.webContents.send("menu:export-pdf")
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => mainWindow?.webContents.send("menu:close")
        },
        { type: "separator" },
        ...(isMac ? [] : [{ role: "quit" }])
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Find...",
          accelerator: "CmdOrCtrl+F",
          click: () => mainWindow?.webContents.send("menu:find")
        },
        {
          label: "Replace...",
          accelerator: "CmdOrCtrl+H",
          click: () => mainWindow?.webContents.send("menu:replace")
        }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Toggle Dark Mode",
          accelerator: "CmdOrCtrl+Shift+D",
          click: () => mainWindow?.webContents.send("menu:toggle-dark")
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    titleBarStyle: "hiddenInset",
    vibrancy: "sidebar",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  rendererReady = true;
  mainWindow.on("close", (event) => {
    if (closeConfirmed || !hasDirtyDocuments) return;
    // Cancel the close and ask before discarding unsaved edits; without this
    // Electron would silently refuse to close the window.
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      message: "You have unsaved changes",
      detail: "Your changes will be lost if you close without saving.",
      buttons: ["Close Without Saving", "Cancel"],
      defaultId: 0,
      cancelId: 1
    });
    if (choice === 0) {
      closeConfirmed = true;
      mainWindow.close();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    rendererReady = false;
    hasDirtyDocuments = false;
    closeConfirmed = false;
  });

  const pathsToOpen = [...pendingExternalPaths];
  pendingExternalPaths = [];
  for (const filePath of pathsToOpen) {
    try {
      await openExternalFile(filePath);
    } catch (error) {
      dialog.showErrorBox("Could not open Markdown file", error.message);
    }
  }
}

app.setName("PlainMark");

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  openExternalFile(filePath).catch((error) => {
    dialog.showErrorBox("Could not open Markdown file", error.message);
  });
});

app.whenReady().then(async () => {
  createMenu();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("markdown:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Markdown",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] },
      { name: "Text", extensions: ["txt"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return Promise.all(result.filePaths.map((filePath) => readMarkdownFile(filePath)));
});

ipcMain.on("docs:dirty-changed", (_event, hasDirty) => {
  hasDirtyDocuments = Boolean(hasDirty);
});

// Chromium does not propagate nativeTheme overrides into the renderer's
// prefers-color-scheme media query, so push scheme changes over IPC.
function broadcastNativeTheme() {
  if (mainWindow && rendererReady) {
    mainWindow.webContents.send(
      "theme:native-changed",
      nativeTheme.shouldUseDarkColors ? "dark" : "light"
    );
  }
}

nativeTheme.on("updated", broadcastNativeTheme);

ipcMain.handle("theme:set", async (_event, mode) => {
  if (mode === "system") {
    nativeTheme.themeSource = "system";
  } else if (mode === "dark") {
    nativeTheme.themeSource = "dark";
  } else {
    nativeTheme.themeSource = "light";
  }
});

ipcMain.handle("theme:get", () => {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
});

ipcMain.handle("markdown:save", async (_event, file) => {
  return writeMarkdownFile(file);
});

ipcMain.handle("markdown:save-as", async (_event, file) => {
  return writeMarkdownFile(file, true);
});

ipcMain.handle("export:html", async (_event, file) => {
  return exportHtmlFile(file);
});

ipcMain.handle("export:pdf", async (_event, file) => {
  return exportPdfFile(file);
});

ipcMain.handle("file:watch", (_event, filePath) => {
  watchFile(filePath);
});

ipcMain.handle("file:unwatch", (_event, filePath) => {
  unwatchFile(filePath);
});

ipcMain.handle("markdown:read", async (_event, filePath) => {
  return readMarkdownFile(filePath);
});

ipcMain.handle("app:version", () => {
  return app.getVersion();
});
