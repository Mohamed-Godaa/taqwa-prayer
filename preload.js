const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('widget', {
  drag: (dx, dy) => ipcRenderer.send('window-drag', { dx, dy }),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  quit: () => ipcRenderer.send('window-quit'),
  fit: (h) => ipcRenderer.send('window-resize', h),
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  setProgress: (frac) => ipcRenderer.send('taskbar-progress', frac),
  setTaskbar: (show) => ipcRenderer.send('taskbar-show', show),
  setStartup: (enable) => ipcRenderer.send('startup-set', enable),
  setTrayMin: (enable) => ipcRenderer.send('traymin-set', enable),
  setJumpList: (lines) => ipcRenderer.send('jumplist-set', lines),
  isWidget: true
});
