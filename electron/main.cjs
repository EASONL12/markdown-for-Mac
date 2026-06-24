const { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } = require("electron");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

let mainWindow = null;
let rendererReady = false;
let pendingExternalPaths = [];
const fileWatchers = new Map();

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

  try {
    let lastEvent = 0;
    const watcher = fsSync.watch(filePath, () => {
      const now = Date.now();
      if (now - lastEvent < 500) return;
      lastEvent = now;
      if (mainWindow && rendererReady) {
        mainWindow.webContents.send("file:modified", filePath);
      }
    });
    fileWatchers.set(filePath, watcher);
  } catch {
    // File may not exist yet, ignore
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
  await fs.writeFile(tmpPath, file.content, "utf8");
  await fs.rename(tmpPath, targetPath);
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

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(file.html);
    await pdfWindow.loadURL(dataUrl);
    const pdfData = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4"
    });
    await fs.writeFile(targetPath, pdfData);
    return targetPath;
  } finally {
    pdfWindow.close();
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
  const bgColor = nativeTheme.shouldUseDarkColors ? "#1a1e1c" : "#f4f6f5";
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 860,
    minHeight: 620,
    titleBarStyle: "hiddenInset",
    backgroundColor: bgColor,
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
  mainWindow.on("closed", () => {
    mainWindow = null;
    rendererReady = false;
  });

  const pathsToOpen = [...pendingExternalPaths];
  pendingExternalPaths = [];
  for (const filePath of pathsToOpen) {
    await openExternalFile(filePath);
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
