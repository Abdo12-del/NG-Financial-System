const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

let mainWindow = null;
let serverProcess = null;
const appRoot = path.resolve(__dirname, '..');
let serverUrl = null;

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function startBackendServer(port) {
  const serverPath = path.join(appRoot, 'server/index.js');
  const bundledNode = path.join(appRoot, 'runtime/node.exe');
  const executable = require('fs').existsSync(bundledNode) ? bundledNode : process.execPath;
  serverProcess = spawn(executable, [serverPath], {
    cwd: appRoot,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      ...(executable === process.execPath ? { ELECTRON_RUN_AS_NODE: '1' } : {})
    },
    stdio: 'inherit',
    windowsHide: true
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start local financial server:', err);
  });

  serverProcess.on('exit', (code) => {
    if (code !== null && code !== 0 && !app.isQuitting) {
      dialog.showErrorBox('NG Financial System', `تعذر تشغيل خادم النظام (رمز الخروج ${code}).`);
      app.quit();
    }
  });
}

function waitForBackend(attempt = 0) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${serverUrl}/api/status`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        let status;
        try {
          status = JSON.parse(body);
        } catch {
          status = null;
        }

        if (response.statusCode === 200 && status?.status === 'online' && status?.app === 'NG Financial System') {
          resolve();
        } else {
          retryOrReject(new Error(`Backend health check failed (HTTP ${response.statusCode}).`));
        }
      });
    });
    request.setTimeout(2000, () => request.destroy(new Error('Backend request timed out.')));
    request.on('error', error => retryOrReject(error));

    function retryOrReject(error) {
      if (serverProcess && serverProcess.exitCode !== null) {
        reject(new Error(`Local server exited with code ${serverProcess.exitCode}: ${error.message}`));
      } else if (attempt >= 119) {
        reject(new Error(`Local server did not become ready: ${error.message}`));
      } else {
        setTimeout(() => waitForBackend(attempt + 1).then(resolve, reject), 500);
      }
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'NG Financial System - NG Academy',
    icon: path.join(appRoot, 'assets/ng-financial-system.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    backgroundColor: '#0F172A'
  });

  mainWindow.loadURL(serverUrl);
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    if (code !== -3) console.error(`Window load failed (${code}): ${description}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  findAvailablePort()
    .then(port => {
      serverUrl = `http://127.0.0.1:${port}`;
      startBackendServer(port);
      return waitForBackend();
    })
    .then(createWindow)
    .catch(error => {
      console.error('Failed to initialize the local financial server:', error);
      dialog.showErrorBox('NG Financial System', `${error.message}\n\nيرجى إعادة تشغيل البرنامج.`);
      app.quit();
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGINT');
});
