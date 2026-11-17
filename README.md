# Likhi — The board, reimagined.

Likhi is a free interactive whiteboard for teachers. It works on Windows smart boards, laptops and Macs, in any modern Chrome or Edge, and fully offline.

## What's inside this folder

| File / folder | What it is |
|---|---|
| `index.html` | **The whole app in one file.** Double-click it to use Likhi offline, or put it on a website. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Let people **install** Likhi from the website and use it offline. |
| `desktop/` | The **Windows app** project (Electron). GitHub builds the `.exe` from it. |
| `.github/workflows/build-windows.yml` | The recipe GitHub uses to build `Likhi-Setup-1.0.0.exe` and `Likhi-Portable-1.0.0.exe`. |

## 1. Use it right now (no internet needed)
Double-click `index.html`. It opens in your browser and saves your board automatically.

## 2. Put it on the web

**Netlify:** go to <https://app.netlify.com/drop> and drag this whole `likhi` folder onto the page. You get a link like `likhi-yourname.netlify.app`.

**GitHub Pages:**
1. Make a new repository on GitHub (for example `likhi`) and upload everything in this folder, including the hidden `.github` folder.
   - Tip: GitHub Desktop or `git push` keeps hidden folders. If you upload in the browser, drag the files and folders in; if `.github` doesn't appear, create the file `.github/workflows/build-windows.yml` by hand with **Add file → Create new file** and paste its contents.
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.**
3. After a minute your site is at `https://YOUR-NAME.github.io/likhi/`.

On the website, Chrome and Edge show an **Install** button in the address bar, so Likhi opens in its own window and works offline.

## 3. Get the Windows .exe
GitHub builds it for free on its own Windows computers — you don't need a Windows PC.

1. Upload this folder to a GitHub repository (as above).
2. Open the **Actions** tab → **Build Windows app** → **Run workflow**.
3. Wait about 5 minutes, open the finished run, and download **Likhi-Windows** at the bottom. Inside:
   - `Likhi-Setup-1.0.0.exe` — installer (Start menu + desktop shortcut, opens `.likhi` files)
   - `Likhi-Portable-1.0.0.exe` — runs without installing (good for a USB stick)

To publish a proper download page, push a tag: `git tag v1.0.0 && git push --tags`. The `.exe` files are then attached to a **Release**.

**First run on Windows:** the app isn't code-signed (certificates cost money), so Windows may show **"Windows protected your PC"**. Click **More info → Run anyway**. This is normal for free apps.

### Windows-only extra: draw on the screen
In the Windows app, **Insert → Draw on the screen** (or **Ctrl+Shift+D** from anywhere) puts a transparent layer over everything — PowerPoint, YouTube, any app.
- The arrow button switches to **mouse mode** so you can click the apps underneath; tap it again to draw.
- **×** closes it and brings Likhi back.

In the browser version the same button takes a **screenshot** of a window or screen and puts it on a new page to write on.

## Keyboard shortcuts
Ctrl+Z undo · Ctrl+Y redo · Ctrl+S save · Ctrl+Shift+S save as · Ctrl+O open · Ctrl+P print · Ctrl+C/X/V copy/cut/paste · Ctrl+D clone · Delete · arrow keys nudge · Esc close menus.

## Files
Boards save as `.likhi` files (plain JSON with any pictures inside). Pages can also be exported as PNG, the whole board as PDF, printed, or emailed as a PDF.

## Building the Windows app on your own PC (optional)
Needs Node.js 20+:
```
cd desktop
mkdir app && copy ..\index.html app\index.html
npm install
npm start        # try it
npm run dist     # makes the .exe files in desktop/dist
```
