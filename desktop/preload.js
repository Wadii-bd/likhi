// The only bridge between the page and Windows: files, closing, and the draw-on-screen overlay.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('likhiDesktop', {
  // files
  saveFile: opts => ipcRenderer.invoke('file:save', opts),          // { path?, name, text } -> { path, name } | null
  writeFile: (path, text) => ipcRenderer.invoke('file:write', path, text),
  openFile: () => ipcRenderer.invoke('file:open'),                  // -> { path, name, text } | null
  onOpenFile: cb => ipcRenderer.on('open-file', (e, name, text, path) => cb(name, text, path)),
  // closing the window
  onCloseRequest: cb => ipcRenderer.on('app:close-request', () => cb()),
  confirmClose: () => ipcRenderer.send('app:close-ok'),
  // draw on the screen
  openOverlay: () => ipcRenderer.send('overlay:open'),
  closeOverlay: () => ipcRenderer.send('overlay:close'),
  setIgnore: v => ipcRenderer.send('overlay:ignore', !!v)
});
