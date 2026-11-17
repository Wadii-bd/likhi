// The only bridge between the page and Windows: open/close the screen overlay, click-through, and opening .likhi files.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('likhiDesktop', {
  openOverlay: () => ipcRenderer.send('overlay:open'),
  closeOverlay: () => ipcRenderer.send('overlay:close'),
  setIgnore: v => ipcRenderer.send('overlay:ignore', !!v),
  onOpenFile: cb => ipcRenderer.on('open-file', (e, name, text) => cb(name, text))
});
