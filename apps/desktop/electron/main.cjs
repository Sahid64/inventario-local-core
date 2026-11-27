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

app.setName('Inventario Local');

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
      if (backendExitError) {
        reject(backendExitError);
        return;
      }
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
      backendRoot: path.join(__dirname, '..', 'resources-bundle', 'backend'),
      frontendIndex: path.join(__dirname, '..', 'resources-bundle', 'frontend', 'index.html'),
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
  if (fs.existsSync(targetDb) && fs.statSync(targetDb).size > 0) {
    return;
  }

  const packagedSeed = path.join(backendRoot, 'seed.db');
  const devSeed = path.join(backendRoot, 'prisma', 'inventario_local.db');
  const templateDb = fs.existsSync(packagedSeed) ? packagedSeed : devSeed;

  if (fs.existsSync(templateDb)) {
    fs.copyFileSync(templateDb, targetDb);
  }
}

let backendExitError = null;
let backendLogStream = null;

function startBackend(port, appDataDir, appSecret, backendRoot) {
  const serverEntry = path.join(backendRoot, 'dist', 'server.js');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `No se encontró el backend compilado en ${serverEntry}. Ejecuta "npm run build" primero.`
    );
  }

  const logsDir = path.join(appDataDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  backendLogStream = fs.createWriteStream(path.join(logsDir, 'backend.log'), { flags: 'a' });
  backendLogStream.write(`\n--- Arranque ${new Date().toISOString()} (port=${port}) ---\n`);

  backendExitError = null;
  const dbFilePath = path.join(appDataDir, 'inventario_local.db');

  const envVars = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    APP_DATA_DIR: appDataDir,
    DB_FILE_PATH: dbFilePath,
    DATABASE_URL: `file:${dbFilePath}`,
    APP_SECRET: appSecret,
  };

  if (app.isPackaged) {
    const unpackedClientDir = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'resources-bundle',
      'backend',
      'node_modules',
      '.prisma',
      'client'
    );
    if (fs.existsSync(unpackedClientDir)) {
      const engineFile = fs
        .readdirSync(unpackedClientDir)
        .find((f) => f.includes('query_engine') && f.endsWith('.node'));
      if (engineFile) {
        envVars.PRISMA_QUERY_ENGINE_LIBRARY = path.join(unpackedClientDir, engineFile);
      }
    }
  }

  let stderrTail = '';

  backendProcess = spawn(process.execPath, [serverEntry], {
    cwd: appDataDir,
    env: envVars,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    backendLogStream?.write(text);
    console.log(`[Backend] ${text.trim()}`);
  });

  backendProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderrTail = (stderrTail + text).slice(-2000);
    backendLogStream?.write(`[ERR] ${text}`);
    console.error(`[Backend ERR] ${text.trim()}`);
  });

  backendProcess.on('exit', (code, signal) => {
    const msg = `[Backend] Proceso finalizado (code=${code}, signal=${signal})`;
    backendLogStream?.write(`${msg}\n`);
    console.log(msg);
    if (code && code !== 0 && !isQuitting) {
      backendExitError = new Error(
        `El backend local se cerró inesperadamente (código ${code}).\n${stderrTail}`
      );
    }
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;

  const proc = backendProcess;
  backendProcess = null;
  backendLogStream?.end();
  backendLogStream = null;

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
      devTools: !app.isPackaged,
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
