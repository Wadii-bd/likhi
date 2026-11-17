// Likhi for Windows (Electron). The whole app lives in app/index.html — the same file as the web version.
const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let main = null, overlay = null, allowClose = false;
const APP_FILE = path.join(__dirname, 'app', 'index.html');
const ICON = path.join(__dirname, 'build', 'icon.ico');
const webPreferences = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false };

// only one Likhi window at a time; double-clicking a .likhi file opens it in the running app
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', (e, argv) => { if (main) { if (main.isMinimized()) main.restore(); main.focus(); openFromArgs(argv); } });

function boardFileFrom(argv) { return argv.find(a => /\.likhi$/i.test(a) && fs.existsSync(a)); }
function openFromArgs(argv) {
  const f = boardFileFrom(argv || []);
  if (f && main) main.webContents.send('open-file', path.basename(f), fs.readFileSync(f, 'utf8'), f);
}

function createMain() {
  main = new BrowserWindow({
    width: 1400, height: 860, minWidth: 900, minHeight: 600, show: false,
    backgroundColor: '#DCDFD8', autoHideMenuBar: true, icon: ICON, title: 'Likhi', webPreferences
  });
  main.setMenuBarVisibility(false);
  main.once('ready-to-show', () => { main.maximize(); main.show(); });
  main.loadFile(APP_FILE);
  main.webContents.once('did-finish-load', () => openFromArgs(process.argv));
  main.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  main.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // closing the window: let the board ask Save / Save as / Don't save first
  main.on('close', e => {
    if (allowClose || main.webContents.isCrashed()) return;
    e.preventDefault();
    main.webContents.send('app:close-request');
  });
  main.on('closed', () => { main = null; if (overlay) overlay.close(); });
}

// "Draw on the screen": a transparent, always-on-top window over everything
function openOverlay() {
  if (overlay) { overlay.focus(); return; }
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  overlay = new BrowserWindow({
    x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
    transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true, backgroundColor: '#00000000',
    icon: ICON, webPreferences
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(APP_FILE, { query: { overlay: '1' } });
  overlay.on('closed', () => { overlay = null; if (main) { main.restore(); main.focus(); } });
  if (main) main.minimize();
}
function closeOverlay() { if (overlay) overlay.close(); }

ipcMain.on('app:close-ok', () => { allowClose = true; if (main) main.close(); });

// real files on the computer
const likhiFilter = [{ name: 'Likhi board', extensions: ['likhi'] }];
ipcMain.handle('file:save', async (e, { path: p, name, text }) => {
  let target = p;
  if (!target) {
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Save board', defaultPath: path.join(app.getPath('documents'), name || 'Board.likhi'), filters: likhiFilter });
    if (r.canceled || !r.filePath) return null;
    target = /\.likhi$/i.test(r.filePath) ? r.filePath : r.filePath + '.likhi';
  }
  await fs.promises.writeFile(target, text, 'utf8');
  return { path: target, name: path.basename(target) };
});
// any other file (PDF, Word, PowerPoint, picture, notes): normal "Save as" window
ipcMain.handle('file:saveBytes', async (e, { name, data }) => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const kinds = { pdf: 'PDF document', pptx: 'PowerPoint presentation', docx: 'Word document', png: 'Picture', txt: 'Text notes', likhi: 'Likhi board' };
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), {
    title: 'Save as', defaultPath: path.join(app.getPath('documents'), name),
    filters: kinds[ext] ? [{ name: kinds[ext], extensions: [ext] }, { name: 'All files', extensions: ['*'] }] : [{ name: 'All files', extensions: ['*'] }]
  });
  if (r.canceled || !r.filePath) return null;
  await fs.promises.writeFile(r.filePath, Buffer.from(data));
  return { path: r.filePath, name: path.basename(r.filePath) };
});
ipcMain.handle('file:write', async (e, p, text) => { try { await fs.promises.writeFile(p, text, 'utf8'); return true; } catch (err) { return false; } });
// v1.3: every board saves itself straight away into Documents\Likhi — no "save first" needed
const autoDir = () => path.join(app.getPath('documents'), 'Likhi');
const inAutoDir = p => { const d = path.resolve(autoDir()) + path.sep; return typeof p === 'string' && path.resolve(p).toLowerCase().startsWith(d.toLowerCase()); };
const cleanName = n => (String(n || 'Board').replace(/\.likhi$/i, '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Board').slice(0, 120);
async function freePath(base, except) {
  await fs.promises.mkdir(autoDir(), { recursive: true });
  for (let i = 1; i < 1000; i++) {
    const p = path.join(autoDir(), base + (i > 1 ? ` (${i})` : '') + '.likhi');
    if (except && path.resolve(p).toLowerCase() === path.resolve(except).toLowerCase()) return p;
    try { await fs.promises.access(p); } catch (err) { return p; }
  }
  return path.join(autoDir(), base + ' ' + Date.now() + '.likhi');
}
ipcMain.handle('file:autoPath', async (e, name) => {
  try { const p = await freePath(cleanName(name)); await fs.promises.writeFile(p, '', { flag: 'wx' }).catch(() => {}); return { path: p, name: path.basename(p) }; } catch (err) { return null; }
});
// rename / delete only touch files Likhi made itself in Documents\Likhi
ipcMain.handle('file:rename', async (e, p, name) => {
  if (!inAutoDir(p)) return null;
  try { const np = await freePath(cleanName(name), p); if (path.resolve(np) !== path.resolve(p)) await fs.promises.rename(p, np); return { path: np, name: path.basename(np) }; } catch (err) { return null; }
});
ipcMain.handle('file:remove', async (e, p) => {
  if (!inAutoDir(p)) return false;
  try { await fs.promises.unlink(p); return true; } catch (err) { return false; }
});
ipcMain.on('file:show', (e, p) => { if (typeof p === 'string' && p) shell.showItemInFolder(p); });
ipcMain.handle('file:open', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Open board', defaultPath: app.getPath('documents'), filters: likhiFilter, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { path: p, name: path.basename(p), text: await fs.promises.readFile(p, 'utf8') };
});

ipcMain.on('overlay:open', openOverlay);
ipcMain.on('overlay:close', closeOverlay);
ipcMain.on('overlay:ignore', (e, ignore) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.setIgnoreMouseEvents(!!ignore, { forward: true });
});

app.whenReady().then(() => {
  createMain();
  // Ctrl+Shift+D starts / stops drawing on the screen from anywhere
  globalShortcut.register('CommandOrControl+Shift+D', () => (overlay ? closeOverlay() : openOverlay()));
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
