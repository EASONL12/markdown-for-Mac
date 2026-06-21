const { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow = null;
let rendererReady = false;
let pendingExternalPaths = [];

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

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow?.webContents.send("menu:open")
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("menu:save")
        },
        { type: "separator" },
        { role: "quit" }
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
  let targetPath = file.path;

  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Save Markdown",
      defaultPath: "Untitled.md",
      filters: [{ name: "Markdown", extensions: ["md"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    targetPath = result.filePath;
  }

  await fs.writeFile(targetPath, file.content, "utf8");
  return { path: targetPath, content: file.content };
});
