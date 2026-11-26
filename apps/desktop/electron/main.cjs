const { app, BrowserWindow, dialog, Menu } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

// Evitar múltiples instancias simultáneas sobre la misma base de datos SQLite
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      const port = typeof address === 'object' && address ? address.port : 3001;
      srv.close(() => resolve(port));
    });
  });
}

function waitForHealth(port, timeoutMs = 25000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/v1/health',
          timeout: 1500,
        },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
            return;
          }
          retry();
        }
      );

      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('El servidor backend local no respondió a tiempo en /api/v1/health.'));
        return;
      }
      setTimeout(check, 250);
    };

    check();
  });
}

function resolvePaths() {
  if (app.isPackaged) {
    return {
      backendRoot: path.join(process.resourcesPath, 'backend'),
      frontendIndex: path.join(process.resourcesPath, 'frontend', 'index.html'),
    };
  }

  const repoRoot = path.resolve(__dirname, '../../..');
  return {
    backendRoot: path.join(repoRoot, 'apps', 'backend'),
    frontendIndex: path.join(repoRoot, 'apps', 'frontend', 'dist', 'index.html'),
  };
}

function ensureInitialDatabase(appDataDir, backendRoot) {
  fs.mkdirSync(appDataDir, { recursive: true });
  const targetDb = path.join(appDataDir, 'inventario_local.db');
  if (fs.existsSync(targetDb)) {
    return;
  }

  const templateDb = path.join(backendRoot, 'prisma', 'inventario_local.db');
  if (fs.existsSync(templateDb)) {
    fs.copyFileSync(templateDb, targetDb);
  }
}

function startBackend(port, appDataDir, appSecret, backendRoot) {
  const serverEntry = path.join(backendRoot, 'dist', 'server.js');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `No se encontró el backend compilado en ${serverEntry}. Ejecuta "npm run build" primero.`
    );
  }

  const envVars = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    APP_DATA_DIR: appDataDir,
    APP_SECRET: appSecret,
  };

  backendProcess = spawn(process.execPath, [serverEntry], {
    cwd: backendRoot,
    env: envVars,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout?.on('data', (chunk) => {
    console.log(`[Backend] ${chunk.toString().trim()}`);
  });

  backendProcess.stderr?.on('data', (chunk) => {
    console.error(`[Backend ERR] ${chunk.toString().trim()}`);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Backend] Proceso finalizado (code=${code}, signal=${signal})`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;

  const proc = backendProcess;
  backendProcess = null;

  try {
    proc.kill('SIGTERM');
  } catch {
    // Ignorar si ya cerró
  }

  setTimeout(() => {
    if (!proc.killed) {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Ignorar
      }
    }
  }, 3000).unref();
}

async function createMainWindow(port, appSecret, frontendIndex) {
  Menu.setApplicationMenu(null);

  const backendOrigin = `http://127.0.0.1:${port}`;
  const apiUrl = `${backendOrigin}/api/v1`;

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    title: 'Inventario Local',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [
        `--api-url=${apiUrl}`,
        `--backend-origin=${backendOrigin}`,
        `--app-secret=${appSecret}`,
      ],
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.ELECTRON_DEV_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_DEV_URL);
  } else {
    if (!fs.existsSync(frontendIndex)) {
      throw new Error(
        `No se encontró el frontend compilado en ${frontendIndex}. Ejecuta "npm run build" primero.`
      );
    }
    await mainWindow.loadFile(frontendIndex);
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    const { backendRoot, frontendIndex } = resolvePaths();
    const appDataDir = app.getPath('userData');
    const appSecret = crypto.randomBytes(32).toString('hex');
    const port = await getFreePort();

    ensureInitialDatabase(appDataDir, backendRoot);
    startBackend(port, appDataDir, appSecret, backendRoot);
    await waitForHealth(port);
    await createMainWindow(port, appSecret, frontendIndex);
  } catch (error) {
    console.error('[Desktop] Error fatal al iniciar:', error);
    dialog.showErrorBox(
      'Error al iniciar Inventario Local',
      error instanceof Error ? error.message : String(error)
    );
    stopBackend();
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopBackend();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});
