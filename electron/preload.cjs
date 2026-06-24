const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("plainmark", {
  openMarkdown: () => ipcRenderer.invoke("markdown:open"),
  saveMarkdown: (file) => ipcRenderer.invoke("markdown:save", file),
  saveMarkdownAs: (file) => ipcRenderer.invoke("markdown:save-as", file),
  onExternalFileOpen: (callback) => subscribe("markdown:external-open", callback),
  onMenuOpen: (callback) => subscribe("menu:open", callback),
  onMenuOpenRecent: (callback) => subscribe("menu:open-recent", callback),
  onMenuNew: (callback) => subscribe("menu:new", callback),
  onMenuClose: (callback) => subscribe("menu:close", callback),
  onMenuSave: (callback) => subscribe("menu:save", callback),
  onMenuSaveAs: (callback) => subscribe("menu:save-as", callback),
  setTheme: (mode) => ipcRenderer.invoke("theme:set", mode),
  getTheme: () => ipcRenderer.invoke("theme:get"),
  onMenuToggleDark: (callback) => subscribe("menu:toggle-dark", callback),
  onMenuFind: (callback) => subscribe("menu:find", callback),
  onMenuReplace: (callback) => subscribe("menu:replace", callback),
  watchFile: (filePath) => ipcRenderer.invoke("file:watch", filePath),
  unwatchFile: (filePath) => ipcRenderer.invoke("file:unwatch", filePath),
  onFileModified: (callback) => subscribe("file:modified", callback),
  readFile: (filePath) => ipcRenderer.invoke("markdown:read", filePath),
  getVersion: () => ipcRenderer.invoke("app:version")
});
