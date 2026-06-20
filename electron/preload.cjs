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
  onMenuSave: (callback) => subscribe("menu:save", callback)
});
