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
// 2.0: automatic backup to a folder or USB drive the teacher picks. Only that folder is ever written to.
const backupCfg = () => path.join(app.getPath('userData'), 'backup.json');
let backupDir = null; try { backupDir = JSON.parse(fs.readFileSync(backupCfg(), 'utf8')).dir || null; } catch (err) {}
ipcMain.handle('backup:pick', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Choose a folder or USB drive for backups', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  backupDir = r.filePaths[0]; try { fs.writeFileSync(backupCfg(), JSON.stringify({ dir: backupDir })); } catch (err) {}
  return backupDir;
});
ipcMain.handle('backup:dir', () => backupDir);
ipcMain.handle('backup:clear', () => { backupDir = null; try { fs.unlinkSync(backupCfg()); } catch (err) {} return true; });
ipcMain.handle('backup:write', async (e, { day, files, keep }) => {
  if (!backupDir) return { ok: false, why: 'no-folder' };
  try { await fs.promises.access(backupDir); } catch (err) { return { ok: false, why: 'missing' }; }
  const root = path.join(backupDir, 'Likhi backups'), dayDir = path.join(root, String(day).replace(/[^0-9-]/g, '').slice(0, 10) || 'backup');
  try {
    await fs.promises.mkdir(dayDir, { recursive: true });
    const used = new Set();
    for (const f of files) {
      let base = String(f.name || 'Board').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 100) || 'Board', n = base, i = 2;
      while (used.has(n.toLowerCase())) n = `${base} (${i++})`; used.add(n.toLowerCase());
      await fs.promises.writeFile(path.join(dayDir, n + '.likhi'), f.text, 'utf8');
    }
    // keep only the newest few days
    const days = (await fs.promises.readdir(root, { withFileTypes: true })).filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name)).map(d => d.name).sort();
    for (const d of days.slice(0, Math.max(0, days.length - (keep || 7)))) await fs.promises.rm(path.join(root, d), { recursive: true, force: true });
    return { ok: true, dir: dayDir, count: files.length };
  } catch (err) { return { ok: false, why: 'write', msg: String(err.message || err) }; }
});
// 2.0 (experimental): "Photo from phone" — while the QR window is open, a tiny receiver runs on this
// computer. A phone on the same Wi-Fi scans the code, picks photos, and they appear on the board.
// It needs the secret code from the QR, accepts only pictures, and stops when the window closes (or after 30 min).
const http = require('http'), os = require('os'), crypto = require('crypto');
let phone = null;   // { server, token, timer, wc }
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) {
    if (a.family !== 'IPv4' && a.family !== 4) continue; if (a.internal) continue;
    if (/^169\.254\./.test(a.address)) continue;
    const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address), virt = /vmware|virtualbox|vethernet|hyper-v|loopback|docker|wsl/i.test(name);
    out.push({ ip: a.address, score: (priv ? 2 : 0) + (virt ? -3 : 0) + (/wi-?fi|wlan|wireless/i.test(name) ? 1 : 0) });
  }
  return out.sort((a, b) => b.score - a.score).map(a => a.ip);
}
function stopPhone() { if (!phone) return; try { phone.server.close(); } catch (e) {} clearTimeout(phone.timer); phone = null; }
const PHONE_PAGE = token => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Send photos to Likhi</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#1F4D3A;color:#F7F3E8;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;text-align:center}
h1{font-size:26px;margin:0 0 6px}p{opacity:.85;margin:0 0 22px;font-size:15px}.b{display:block;width:100%;max-width:340px;box-sizing:border-box;margin:8px auto;padding:18px;border-radius:16px;border:0;font-size:18px;font-weight:700;background:#F2C94C;color:#1F2A24}
.b.s{background:#F7F3E8}#st{margin-top:18px;min-height:24px;font-size:15px}input{display:none}small{opacity:.6;margin-top:26px;font-size:12px}</style></head><body>
<h1>Send photos to the board</h1><p>Your photos appear on the Likhi board straight away.</p>
<label class="b">Take a photo<input id="cam" type="file" accept="image/*" capture="environment"></label>
<label class="b s">Choose photos<input id="pick" type="file" accept="image/*" multiple></label>
<div id="st"></div><small>Likhi · experimental</small>
<script>
const T=${JSON.stringify(token)},st=document.getElementById('st');
async function shrink(f){try{const bm=await createImageBitmap(f);const k=Math.min(1,2200/Math.max(bm.width,bm.height));const c=document.createElement('canvas');c.width=Math.round(bm.width*k);c.height=Math.round(bm.height*k);c.getContext('2d').drawImage(bm,0,0,c.width,c.height);return await new Promise(r=>c.toBlob(r,'image/jpeg',0.86));}catch(e){return f;}}
async function send(files){let ok=0;for(const f of files){st.textContent='Sending '+(ok+1)+' of '+files.length+'…';try{const b=await shrink(f);const r=await fetch('/upload?t='+T,{method:'POST',headers:{'Content-Type':b.type||'image/jpeg'},body:b});if(r.ok)ok++;else{st.textContent=r.status===403?'This code has expired — scan the new QR code on the board.':'The board could not take that photo.';return;}}catch(e){st.textContent='Lost connection to the board.';return;}}
st.textContent=ok===1?'✓ Sent! Send another?':'✓ '+ok+' photos sent!';}
for(const id of ['cam','pick'])document.getElementById(id).onchange=e=>{const f=[...e.target.files];e.target.value='';if(f.length)send(f);};
</script></body></html>`;
ipcMain.handle('phone:start', async e => {
  stopPhone();
  const token = crypto.randomBytes(12).toString('hex'), wc = e.sender;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), good = u.searchParams.get('t') === token;
    if (!phone || !good) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('This QR code has expired. Scan the new one on the board.'); }
    phone.timer.refresh && phone.timer.refresh();
    if (req.method === 'GET' && u.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(PHONE_PAGE(token)); }
    if (req.method === 'POST' && u.pathname === '/upload') {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!/^image\/(jpeg|png|webp|gif|heic|heif|bmp)$/.test(type)) { res.writeHead(415); return res.end('Pictures only'); }
      const chunks = []; let size = 0, dead = false;
      req.on('data', c => { size += c.length; if (size > 25 * 1024 * 1024) { dead = true; res.writeHead(413); res.end('Too big'); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (dead) return;
        try { if (!wc.isDestroyed()) wc.send('phone:photo', `data:${type};base64,` + Buffer.concat(chunks).toString('base64')); } catch (err) {}
        res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
      });
      return;
    }
    res.writeHead(404); res.end();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '0.0.0.0', resolve); });
  const port = server.address().port, ips = lanAddresses();
  phone = { server, token, wc, timer: setTimeout(stopPhone, 30 * 60 * 1000) };
  return { urls: ips.map(ip => `http://${ip}:${port}/?t=${token}`), port };
});
ipcMain.handle('phone:stop', () => { stopPhone(); return true; });
app.on('before-quit', stopPhone);

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
