const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain } = require('electron');
const path = require('path');

// Required on Windows so toasts land in Notification Center
// and the taskbar groups the app correctly.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.taqwa.prayer');
}

let win = null;
let tray = null;
let trayMenu = null; // module scope: never let the context menu be GC'd
let minimizeToTray = true;

function createWindow() {
  win = new BrowserWindow({
    width: 442,
    height: 430,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: false, // visible in taskbar so it can be pinned (right-click pin)
    icon: path.join(__dirname, 'build/icon.ico'),
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Taqwa Prayer',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');

  // Close (X) -> hide to tray so prayer alerts keep firing.
  // Use tray Quit for a real exit.
  win.on('close', (e) => {
    if (minimizeToTray && !app.quitting) {
      e.preventDefault();
      win.hide();
      if (tray) tray.displayBalloon({
        title: 'Taqwa Prayer',
        content: 'Still running in the tray — right-click the tray icon and Quit to exit.'
      });
    }
  });

  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' });
}

function showToast(title, body) {
  const n = new Notification({ title, body, silent: false });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show(); // on Windows this persists in Notification Center
}

function trayIcon() {
  // A visible icon is essential: with an empty image the tray entry
  // is invisible and users can never reach the Quit item.
  for (const f of ['build/icon.png', 'build/icon.ico']) {
    try {
      const img = nativeImage.createFromPath(path.join(__dirname, f));
      if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
    } catch (_) {}
  }
  return nativeImage.createEmpty();
}

function buildTray() {
  try {
    const startup = app.getLoginItemSettings().openAtLogin;
    tray = new Tray(trayIcon());
    tray.setToolTip('Taqwa Prayer — prayer times (right-click to quit)');
    trayMenu = Menu.buildFromTemplate([      { label: 'Show widget', click: () => { win && win.show(); win && win.focus(); } },
      { label: 'Hide widget', click: () => win && win.hide() },
      { type: 'separator' },
      {
        label: 'Show in taskbar', type: 'checkbox', checked: win ? !win.isSkipTaskbar() : true,
        click: (m) => win && win.setSkipTaskbar(!m.checked)
      },
      {
        label: 'Launch at startup', type: 'checkbox', checked: startup,
        click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked })
      },
      {
        label: 'Minimize to tray on close', type: 'checkbox', checked: minimizeToTray,
        click: (m) => { minimizeToTray = m.checked; }
      },
      { type: 'separator' },
      { label: 'Test notification', click: () => showToast('Taqwa Prayer', 'Notifications are on — you will see prayer alerts here.') },
      { label: 'Quit', click: () => { app.quitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(trayMenu);
    // Explicit popup: on some Windows builds the menu set above alone
    // does not open on right-click, so pop it ourselves too.
    tray.on('right-click', () => { try { tray.popUpContextMenu(trayMenu); } catch (_) {} });
    tray.on('click', () => {
      if (!win) return;
      win.isVisible() ? win.hide() : (win.show(), win.focus());
    });
  } catch (_) { /* tray optional */ }
}

app.whenReady().then(() => {
  // One instance only: a second launch focuses the running widget
  // instead of piling up hidden copies in the tray.
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  app.on('second-instance', (_e, argv) => {
    // Jump List "Quit" launches a second process that immediately hands
    // off here — honor it as a quit request for the running instance.
    if ((argv || []).some(a => String(a).includes('--quit'))) {
      app.quitting = true;
      app.quit();
      return;
    }
    if (win) { win.show(); win.focus(); }
  });

  createWindow();
  buildTray();

  // Jump List (right-click taskbar icon): quick actions + Quit,
  // so the app can be exited from the taskbar icon too.
  try {
    app.setJumpList([
      {
        type: 'custom',
        name: 'Taqwa Prayer',
        items: [
          { type: 'task', program: process.execPath, args: '--show', title: 'Show widget', description: 'Show the prayer widget' },
          { type: 'task', program: process.execPath, args: '--test-notify', title: 'Test notification', description: 'Send a test prayer notification' },
          { type: 'separator' },
          { type: 'task', program: process.execPath, args: '--quit', title: 'Quit Taqwa Prayer', description: 'Exit Taqwa Prayer completely' },
        ]
      }
    ]);
  } catch (_) {}

  // CLI from jump list tasks
  if (process.argv.includes('--test-notify')) showToast('Taqwa Prayer', 'Notifications are on.');
  if (process.argv.includes('--show') && win) win.show();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (win) win.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- renderer IPC ---
ipcMain.on('window-drag', (_e, { dx, dy }) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
});
ipcMain.on('window-minimize', () => win && win.minimize());
ipcMain.on('window-close', () => win && win.close());
ipcMain.on('window-quit', () => { app.quitting = true; app.quit(); });
ipcMain.on('window-resize', (_e, h) => {
  // Renderer measures its content and asks for an exact height
  // (the window itself is not user-resizable).
  if (win) win.setSize(442, Math.max(200, Math.min(900, Math.round(h) || 430)));
});
ipcMain.on('notify', (_e, { title, body }) => showToast(title || 'Taqwa Prayer', body || ''));
ipcMain.on('taskbar-progress', (_e, frac) => {
  if (win) win.setProgressBar(Math.max(0, Math.min(1, frac || 0)));
});
ipcMain.on('taskbar-show', (_e, show) => win && win.setSkipTaskbar(!show));
ipcMain.on('startup-set', (_e, enable) => app.setLoginItemSettings({ openAtLogin: !!enable }));
ipcMain.on('traymin-set', (_e, enable) => { minimizeToTray = !!enable; });
ipcMain.on('jumplist-set', (_e, lines) => {
  // lines: ["Fajr 5:00a", ...] shown on taskbar right-click (Quit kept last)
  try {
    app.setJumpList([{
      type: 'custom', name: "Today's prayers",
      items: [
        ...(lines || []).slice(0, 6).map(t => ({
          type: 'task', program: process.execPath, args: '--show', title: String(t).slice(0, 60), description: 'Show the prayer widget'
        })),
        { type: 'separator' },
        { type: 'task', program: process.execPath, args: '--quit', title: 'Quit Taqwa Prayer', description: 'Exit Taqwa Prayer completely' },
      ]
    }]);
  } catch (_) {}
});
