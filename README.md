# Likhi v1.2.1 — The board, reimagined.

Likhi is a free interactive whiteboard for teachers. It works on Windows smart boards, laptops and Macs, in any modern Chrome or Edge, and fully offline.

## What's inside this folder

| File / folder | What it is |
|---|---|
| `index.html` | **The whole app in one file.** Double-click it to use Likhi offline, or put it on a website. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Let people **install** Likhi from the website and use it offline. |
| `desktop/` | The **Windows app** project (Electron). GitHub builds the `.exe` from it. |
| `android-app/` | The **Android app** project (Capacitor). GitHub builds the `.apk` from it. |
| `.github/workflows/build-android.yml` | The recipe GitHub uses to build `Likhi-1.2.1.apk`. |
| `.github/workflows/build-windows.yml` | The recipe GitHub uses to build `Likhi-Setup-1.2.1.exe` and `Likhi-Portable-1.2.1.exe`. |

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
   - `Likhi-Setup-1.2.1.exe` — installer (Start menu + desktop shortcut, opens `.likhi` files)
   - `Likhi-Portable-1.2.1.exe` — runs without installing (good for a USB stick)

To publish a proper download page, push a tag: `git tag v1.2.1 && git push --tags`. The `.exe` files are then attached to a **Release**.

**First run on Windows:** the app isn't code-signed (certificates cost money), so Windows may show **"Windows protected your PC"**. Click **More info → Run anyway**. This is normal for free apps.

## 4. Get the Android app (.apk)
GitHub builds this too — no Android Studio needed.

1. Add your signing key as 4 GitHub secrets (one time): **Settings → Secrets and variables → Actions → New repository secret**. The names and values are in *READ ME - Likhi signing key.txt* (sent separately — never put the key files in this repository).
2. **Actions → Build Android app → Run workflow**. Wait about 6–8 minutes.
3. Download **Likhi-Android** from the finished run. Inside is `Likhi-1.2.1.apk`.
4. Send the APK by WhatsApp or Drive. On the phone, tap it; Android asks once to allow installing from that app.

Without the secrets, the build still works but makes `Likhi-1.2.1-test.apk` — fine for trying, but updates won't install over it later.
In the Android app, Save and Export open the phone's share menu, so you can keep files in Files or Drive, or send them by WhatsApp or Gmail.

### Windows-only extra: draw on the screen
In the Windows app, **Insert → Draw on the screen** (or **Ctrl+Shift+D** from anywhere) puts a transparent layer over everything — PowerPoint, YouTube, any app.
- The arrow button switches to **mouse mode** so you can click the apps underneath; tap it again to draw.
- **×** closes it and brings Likhi back.

In the browser version the same button takes a **screenshot** of a window or screen and puts it on a new page to write on.

## New in 1.2
- Likhi opens on the **dashboard**: create a board, **open a .likhi file**, or **import** PDF, PowerPoint, Word or notes.
- **Save / Save as / Open** real `.likhi` files (Windows app: normal Windows file dialogs). After the first save, every change is **auto-saved into that file** (File → Auto-save to the file).
- Boards are always kept safe inside Likhi on the computer too, so nothing is lost if the power goes.
- Closing a board or the Windows app with unsaved changes asks **Save / Save as / Don't save / Cancel**. In a browser tab, the browser shows its own "Leave site?" warning instead.
- **File · Import · Export** buttons are always at the top of the board.
- **Stylus and drawing tablets**: pen pressure, the pen's eraser end, and the side button to erase.
- **Android, tablets and small screens**: layouts for phones (upright and sideways); the back button closes the board and asks to save.

## New in 1.1
- **Dashboard** with all your boards (search, sort, rename, duplicate, delete) and 8 board types to start from.
- **Import** Word (.docx), PowerPoint (.pptx), notes (.txt/.md), PDF and pictures — as a new board from the dashboard, or into the open board from Insert.
- **Export** as picture, PDF, Word, PowerPoint, notes or a Likhi file (Menu → Export this board as).
- **Settings**: general, writing, sound, look, backup & restore of your preferences, developer tools, and about & credits.
- Optional **pen writing sounds** (Settings → Sound, off by default) and **rough, realistic chalk**.

## Keyboard shortcuts
Ctrl+Z undo · Ctrl+Y redo · Ctrl+S save · Ctrl+Shift+S save as · Ctrl+O open · Ctrl+P print · Ctrl+C/X/V copy/cut/paste · Ctrl+D clone · Delete · arrow keys nudge · Esc close menus.

## Files
Boards save automatically inside the browser (or the Windows app) and show up on the dashboard. Use **File → Save** to also keep the board as a `.likhi` file wherever you like; Likhi then keeps that file up to date as you work. To move a board to another computer, export it as a `.likhi` file (plain JSON with any pictures inside) and open it there. Old `.doc` and `.ppt` files must first be saved as `.docx` / `.pptx` (or PDF).

## Building the Windows app on your own PC (optional)
Needs Node.js 20+:
```
cd desktop
mkdir app && copy ..\index.html app\index.html
npm install
npm start        # try it
npm run dist     # makes the .exe files in desktop/dist
```
