const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("plainmark", {
  openMarkdown: () => ipcRenderer.invoke("markdown:open"),
  saveMarkdown: (file) => ipcRenderer.invoke("markdown:save", file),
  onExternalFileOpen: (callback) => subscribe("markdown:external-open", callback),
  onMenuOpen: (callback) => subscribe("menu:open", callback),
  onMenuSave: (callback) => subscribe("menu:save", callback),
  setTheme: (mode) => ipcRenderer.invoke("theme:set", mode),
  getTheme: () => ipcRenderer.invoke("theme:get"),
  onMenuToggleDark: (callback) => subscribe("menu:toggle-dark", callback),
  onMenuFind: (callback) => subscribe("menu:find", callback),
  onMenuReplace: (callback) => subscribe("menu:replace", callback)
});
