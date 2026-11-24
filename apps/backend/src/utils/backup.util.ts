import fs from 'fs/promises';
import path from 'path';
import { disconnectDatabase, initDatabase, prisma } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';

export interface BackupInfo {
  filename: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
}

function buildTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/**
 * Crea una copia de seguridad consistente de `inventario_local.db` en `/backups`.
 * Ejecuta primero un checkpoint WAL para consolidar todas las transacciones en el archivo .db.
 */
export async function createDatabaseBackup(label?: string): Promise<BackupInfo> {
  await fs.mkdir(env.BACKUPS_DIR, { recursive: true });

  // Asegurar que los cambios del WAL estén volcados al archivo principal
  await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');

  const safeLabel = label
    ? `_${label.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 30)}`
    : '';
  const filename = `inventario_local_${buildTimestamp()}${safeLabel}.db`;
  const targetPath = path.join(env.BACKUPS_DIR, filename);

  try {
    await fs.access(env.DB_FILE_PATH);
  } catch {
    throw new AppError(
      404,
      `No se encontró el archivo de base de datos en ${env.DB_FILE_PATH}.`,
      'DatabaseFileNotFound'
    );
  }

  await fs.copyFile(env.DB_FILE_PATH, targetPath);
  const stats = await fs.stat(targetPath);

  return {
    filename,
    filePath: targetPath,
    sizeBytes: stats.size,
    createdAt: stats.mtime.toISOString(),
  };
}

/**
 * Lista los respaldos disponibles en la carpeta `/backups` ordenados del más reciente al más antiguo.
 */
export async function listDatabaseBackups(): Promise<BackupInfo[]> {
  await fs.mkdir(env.BACKUPS_DIR, { recursive: true });
  const entries = await fs.readdir(env.BACKUPS_DIR);

  const backups: BackupInfo[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.db')) continue;
    const filePath = path.join(env.BACKUPS_DIR, entry);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) continue;

    backups.push({
      filename: entry,
      filePath,
      sizeBytes: stats.size,
      createdAt: stats.mtime.toISOString(),
    });
  }

  return backups.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Restaura la base de datos SQLite a partir de un archivo de respaldo ubicado en `/backups`.
 * Antes de sobrescribir, genera un respaldo preventivo automático.
 */
export async function restoreDatabaseBackup(filename: string): Promise<{
  restoredFrom: string;
  safetyBackup: BackupInfo;
}> {
  const safeName = path.basename(filename);
  if (safeName !== filename || !safeName.endsWith('.db')) {
    throw new AppError(400, 'Nombre de archivo de respaldo inválido.', 'InvalidBackupFilename');
  }

  const sourcePath = path.join(env.BACKUPS_DIR, safeName);
  try {
    await fs.access(sourcePath);
  } catch {
    throw new AppError(404, `El respaldo "${safeName}" no existe.`, 'BackupNotFound');
  }

  const safetyBackup = await createDatabaseBackup('pre-restore');

  await disconnectDatabase();

  try {
    // Eliminar archivos WAL/SHM antiguos para evitar corrupción al restaurar
    await fs.rm(`${env.DB_FILE_PATH}-wal`, { force: true });
    await fs.rm(`${env.DB_FILE_PATH}-shm`, { force: true });

    await fs.copyFile(sourcePath, env.DB_FILE_PATH);
  } finally {
    await initDatabase();
  }

  return {
    restoredFrom: safeName,
    safetyBackup,
  };
}
