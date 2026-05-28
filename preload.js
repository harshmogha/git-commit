const { contextBridge, ipcRenderer } = require('electron');

// Only expose safe methods — token NEVER crosses this bridge
contextBridge.exposeInMainWorld('gitCommit', {
  isAuthenticated: () => ipcRenderer.invoke('is-authenticated'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  loginWithToken: (token) => ipcRenderer.invoke('login-with-token', token),
  getUser: () => ipcRenderer.invoke('get-user'),
  getRepos: () => ipcRenderer.invoke('get-repos'),
  ghApi: (path, method, body) => ipcRenderer.invoke('gh-api', { path, method, body }),
  logout: () => ipcRenderer.invoke('logout'),
  onAuthSuccess: (callback) => { ipcRenderer.removeAllListeners('auth-success'); ipcRenderer.on('auth-success', callback); },
  getLoginUrl: () => `http://localhost:8371/auth/login`,
  winMinimize: () => ipcRenderer.invoke('win-minimize'),
  winMaximize: () => ipcRenderer.invoke('win-maximize'),
  winClose: () => ipcRenderer.invoke('win-close'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  cloneRepo: (url, dest) => ipcRenderer.invoke('clone-repo', { url, dest }),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateProgress: (cb) => { ipcRenderer.removeAllListeners('update-progress'); ipcRenderer.on('update-progress', (e, pct) => cb(pct)); },
  onUpdateDownloaded: (cb) => { ipcRenderer.removeAllListeners('update-downloaded'); ipcRenderer.on('update-downloaded', cb); }
});
