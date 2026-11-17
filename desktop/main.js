// Likhi for Windows (Electron). The whole app lives in app/index.html — the same file as the web version.
const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let main = null, overlay = null;
const APP_FILE = path.join(__dirname, 'app', 'index.html');
const ICON = path.join(__dirname, 'build', 'icon.ico');
const webPreferences = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false };

// only one Likhi window at a time; double-clicking a .likhi file opens it in the running app
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', (e, argv) => { if (main) { if (main.isMinimized()) main.restore(); main.focus(); openFromArgs(argv); } });

function boardFileFrom(argv) { return argv.find(a => /\.likhi$/i.test(a) && fs.existsSync(a)); }
function openFromArgs(argv) {
  const f = boardFileFrom(argv || []);
  if (f && main) main.webContents.send('open-file', path.basename(f), fs.readFileSync(f, 'utf8'));
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
