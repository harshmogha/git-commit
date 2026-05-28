const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { execFile } = require('child_process');
const express = require('express');
const keytar = require('keytar');
require('dotenv').config();

const SERVICE_NAME = 'GitCommit';
const ACCOUNT_NAME = 'github_token';

let mainWindow;
let accessToken = null; // Token lives ONLY here in main process memory

const PORT = 8371;
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;

// ── Express OAuth Server ──
const oauthServer = express();
let oauthState = null; // SECURITY: CSRF protection
let oauthAttempts = 0; // SECURITY: Rate limiting

// SECURITY: Block all routes except auth
oauthServer.use((req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/callback') {
    next();
  } else {
    res.status(404).send('Not found');
  }
});

oauthServer.get('/auth/login', (req, res) => {
  const scope = 'repo read:user';
  // Generate random state to prevent CSRF
  oauthState = require('crypto').randomBytes(16).toString('hex');
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=http://localhost:${PORT}/auth/callback&state=${oauthState}`;
  res.redirect(url);
});

oauthServer.get('/auth/callback', async (req, res) => {
  // SECURITY: Rate limit — max 10 attempts per session
  oauthAttempts++;
  if (oauthAttempts > 10) return res.status(429).send('Too many attempts');

  const { code, state } = req.query;
  if (!code) return res.status(400).send('No code');
  // SECURITY: Validate state to prevent CSRF attacks
  if (!oauthState || state !== oauthState) return res.status(403).send('Invalid state — possible CSRF attack');
  oauthState = null; // Consume state (one-time use)

  const fetch = (await import('node-fetch')).default;
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code })
  });
  const data = await tokenRes.json();

  if (data.access_token) {
    accessToken = data.access_token;
    res.send('<html><body style="background:#F4EBD7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><h1>✓ Signed in! You can close this tab.</h1></body></html>');
    mainWindow.webContents.send('auth-success');
  } else {
    res.status(400).send('<html><body style="background:#F4EBD7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><h1>✕ Authentication failed. Please try again.</h1></body></html>');
  }
});

oauthServer.listen(PORT, '127.0.0.1', () => {
  console.log(`OAuth server running on http://localhost:${PORT}`);
});

// ── IPC Handlers — frontend calls these, never sees the token ──
ipcMain.handle('get-user', async () => {
  return await ghFetch('/user');
});

ipcMain.handle('get-repos', async () => {
  return await ghFetch('/user/repos?per_page=100&sort=updated');
});

ipcMain.handle('gh-api', async (event, { path, method, body }) => {
  // SECURITY: Only allow GitHub API paths — prevent SSRF
  if (typeof path !== 'string') throw new Error('Invalid path');
  if (path.startsWith('http') && !path.startsWith('https://api.github.com')) {
    throw new Error('Only GitHub API requests allowed');
  }
  return await ghFetch(path, method, body);
});

ipcMain.handle('is-authenticated', () => {
  return !!accessToken;
});

ipcMain.handle('open-external', (event, url) => {
  // SECURITY: Only allow http/https URLs — block file://, javascript:, etc.
  if (typeof url !== 'string') return;
  const allowed = url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:');
  if (allowed) shell.openExternal(url);
});

ipcMain.handle('win-minimize', () => mainWindow.minimize());
ipcMain.handle('win-maximize', () => { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.handle('win-close', () => mainWindow.close());

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('clone-repo', async (event, { url, dest }) => {
  // SECURITY: Validate inputs to prevent command injection
  if (typeof url !== 'string' || typeof dest !== 'string') throw new Error('Invalid input');
  // Block shell metacharacters
  const dangerous = /[;&|`$(){}[\]!#~<>]/;
  if (dangerous.test(url) || dangerous.test(dest)) throw new Error('Invalid characters in URL or path');
  // Only allow valid git URLs
  const validUrl = /^(https?:\/\/|git@)[\w.\-\/:@]+$/.test(url) || /^[\w\-]+\/[\w.\-]+$/.test(url);
  if (!validUrl) throw new Error('Invalid repository URL');

  return new Promise((resolve, reject) => {
    execFile('git', ['clone', '--', url, dest], (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout || stderr || 'Done');
    });
  });
});

ipcMain.handle('login-with-token', async (event, token) => {
  // SECURITY: Validate token format
  if (typeof token !== 'string' || token.length < 10 || token.length > 255) throw new Error('Invalid token format');
  if (/[<>"';&|]/.test(token)) throw new Error('Invalid characters in token');

  const fetch = (await import('node-fetch')).default;
  const res = await fetch('https://api.github.com/user', {
    headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (!res.ok) throw new Error('Invalid token');
  accessToken = token;
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
  return true;
});

ipcMain.handle('logout', async () => {
  accessToken = null;
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
  return true;
});

// ── GitHub API fetch (runs in main process with token) ──
async function ghFetch(apiPath, method = 'GET', body = null) {
  if (!accessToken) throw new Error('Not authenticated');
  // SECURITY: Validate method
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (!allowedMethods.includes((method || 'GET').toUpperCase())) throw new Error('Invalid HTTP method');
  // SECURITY: Prevent path traversal
  if (typeof apiPath !== 'string' || apiPath.includes('..')) throw new Error('Invalid path');

  const fetch = (await import('node-fetch')).default;
  const url = apiPath.startsWith('https://api.github.com') ? apiPath : `https://api.github.com${apiPath}`;
  // SECURITY: Final URL must be GitHub API
  if (!url.startsWith('https://api.github.com')) throw new Error('Invalid API URL');

  const opts = {
    method: (method || 'GET').toUpperCase(),
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API ${res.status}`);
  }
  return res.json();
}

// ── Electron Window ──
async function createWindow() {
  // Load saved token from OS keychain
  const savedToken = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  if (savedToken) accessToken = savedToken;

  const { screen } = require('electron');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1100, width),
    height: Math.min(700, height),
    frame: false,
    backgroundColor: '#F4EBD7',
    icon: path.join(__dirname, 'gitcommit.ico'),
    title: 'Git - Commit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableRemoteModule: false
    }
  });
  mainWindow.loadFile('public/index.html');

  // SECURITY: Disable DevTools in production
  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => { mainWindow.webContents.closeDevTools(); });
  }

  // SECURITY: Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

  // SECURITY: Block new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Auto Updater ──
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo) {
      return { available: true, version: result.updateInfo.version };
    }
    return { available: false };
  } catch (e) {
    return { available: false, error: e.message };
  }
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) mainWindow.webContents.send('update-progress', Math.round(progress.percent));
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
});
