import 'dotenv/config';
import os from 'os';
import path from 'path';

const backendRoot = path.resolve(__dirname, '../..');
const NODE_ENV = process.env.NODE_ENV ?? 'development';

function resolveDefaultAppDataDir(): string {
  if (process.env.APP_DATA_DIR && process.env.APP_DATA_DIR.trim() !== '') {
    return path.resolve(process.env.APP_DATA_DIR.trim());
  }

  if (NODE_ENV === 'production') {
    const appFolder = 'InventarioLocalCore';
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appFolder);
    }
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', appFolder);
    }
    return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), appFolder);
  }

  return backendRoot;
}

const APP_DATA_DIR = resolveDefaultAppDataDir();
const isCustomOrProdDataDir = Boolean(process.env.APP_DATA_DIR) || NODE_ENV === 'production';

const DB_FILE_PATH =
  process.env.DB_FILE_PATH ??
  (isCustomOrProdDataDir
    ? path.join(APP_DATA_DIR, 'inventario_local.db')
    : path.join(backendRoot, 'prisma', 'inventario_local.db'));

export const env = {
  NODE_ENV,
  PORT: Number(process.env.PORT ?? 3001),
  // Vinculado estrictamente a loopback local para operación de escritorio segura
  HOST: '127.0.0.1',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  APP_SECRET: process.env.APP_SECRET?.trim() ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? 'inventario-local-dev-secret-change-in-prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '12h',
  APP_DATA_DIR,
  DB_FILE_PATH,
  DATABASE_URL: `file:${DB_FILE_PATH}`,
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? path.join(APP_DATA_DIR, 'uploads'),
  BACKUPS_DIR: process.env.BACKUPS_DIR ?? path.join(APP_DATA_DIR, 'backups'),
  BACKUP_INTERVAL_MINUTES: Number(process.env.BACKUP_INTERVAL_MINUTES ?? 30),
  MAX_AUTO_BACKUPS: Number(process.env.MAX_AUTO_BACKUPS ?? 10),
} as const;
