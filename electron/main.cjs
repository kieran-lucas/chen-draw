const { app, BrowserWindow, net, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const origin = 'chen-studio://app';
const distRoot = path.resolve(__dirname, '..', 'dist');
if (process.env.CHEN_STUDIO_USER_DATA) app.setPath('userData', process.env.CHEN_STUDIO_USER_DATA);

protocol.registerSchemesAsPrivileged([
  { scheme: 'chen-studio', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('ChenStudio.Desktop');
    protocol.handle('chen-studio', (request) => {
      const url = new URL(request.url);
      if (url.host !== 'app') return new Response('Not found', { status: 404 });
      let relative;
      try {
        relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      } catch {
        return new Response('Bad request', { status: 400 });
      }
      const file = path.resolve(distRoot, relative);
      if (!file.startsWith(`${distRoot}${path.sep}`))
        return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    });

    const window = new BrowserWindow({
      title: 'Chen Studio',
      width: 1480,
      height: 920,
      minWidth: 800,
      minHeight: 560,
      backgroundColor: '#f4f7fb',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`${origin}/`)) event.preventDefault();
    });
    window.loadURL(`${origin}/`);
  });

  app.on('window-all-closed', () => app.quit());
}
