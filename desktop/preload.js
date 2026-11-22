// The only bridge between the page and Windows: files, closing, and the draw-on-screen overlay.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('likhiDesktop', {
  // files
  saveFile: opts => ipcRenderer.invoke('file:save', opts),          // { path?, name, text } -> { path, name } | null
  writeFile: (path, text) => ipcRenderer.invoke('file:write', path, text),
  saveBytes: opts => ipcRenderer.invoke('file:saveBytes', opts),        // { name, data:Uint8Array } -> { path, name } | null
  openFile: () => ipcRenderer.invoke('file:open'),
  autoPath: name => ipcRenderer.invoke('file:autoPath', name),     // new file in Documents\Likhi -> { path, name }
  renameFile: (path, name) => ipcRenderer.invoke('file:rename', path, name),
  removeFile: path => ipcRenderer.invoke('file:remove', path),       // only files inside Documents\Likhi
  showFile: path => ipcRenderer.send('file:show', path),
  // photo from phone (2.0, experimental)
  phoneStart: () => ipcRenderer.invoke('phone:start'),             // -> { urls:[...], port }
  phoneStop: () => ipcRenderer.invoke('phone:stop'),
  onPhonePhoto: cb => ipcRenderer.on('phone:photo', (e, dataURL) => cb(dataURL)),
  // automatic backup (2.0)
  backupPick: () => ipcRenderer.invoke('backup:pick'),
  backupDir: () => ipcRenderer.invoke('backup:dir'),
  backupClear: () => ipcRenderer.invoke('backup:clear'),
  backupWrite: opts => ipcRenderer.invoke('backup:write', opts),     // { day:'2026-11-22', files:[{name,text}], keep }                  // -> { path, name, text } | null
  onOpenFile: cb => ipcRenderer.on('open-file', (e, name, text, path) => cb(name, text, path)),
  // closing the window
  onCloseRequest: cb => ipcRenderer.on('app:close-request', () => cb()),
  confirmClose: () => ipcRenderer.send('app:close-ok'),
  // draw on the screen
  openOverlay: () => ipcRenderer.send('overlay:open'),
  closeOverlay: () => ipcRenderer.send('overlay:close'),
  setIgnore: v => ipcRenderer.send('overlay:ignore', !!v)
});
