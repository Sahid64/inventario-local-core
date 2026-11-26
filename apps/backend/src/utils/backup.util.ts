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

let backupIntervalHandle: NodeJS.Timeout | null = null;

function buildTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/**
 * Mantiene únicamente los últimos `maxFiles` respaldos en `env.BACKUPS_DIR`,
 * eliminando los más antiguos para evitar crecimiento ilimitado en disco.
 */
export async function pruneOldBackups(maxFiles = env.MAX_AUTO_BACKUPS): Promise<number> {
  const backups = await listDatabaseBackups();
  if (backups.length <= maxFiles) return 0;

  const toDelete = backups.slice(maxFiles);
  let removed = 0;

  for (const item of toDelete) {
    try {
      await fs.rm(item.filePath, { force: true });
      removed += 1;
    } catch {
      // Continuar con el resto si un archivo está bloqueado
    }
  }

  return removed;
}

/**
 * Crea una copia de seguridad consistente y compactada usando `VACUUM INTO` de SQLite.
 * Seguro incluso con transacciones activas en modo WAL. Rota automáticamente los últimos 10 respaldos.
 */
export async function createDatabaseBackup(label?: string): Promise<BackupInfo> {
  await fs.mkdir(env.BACKUPS_DIR, { recursive: true });

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

  // SQLite VACUUM INTO requiere comillas simples escapadas y archivo destino inexistente
  const escapedTarget = targetPath.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedTarget}';`);

  const stats = await fs.stat(targetPath);

  // Rotar respaldos antiguos manteniendo los últimos N (por defecto 10)
  await pruneOldBackups(env.MAX_AUTO_BACKUPS);

  return {
    filename,
    filePath: targetPath,
    sizeBytes: stats.size,
    createdAt: stats.mtime.toISOString(),
  };
}

/**
 * Lista los respaldos disponibles en `env.BACKUPS_DIR` ordenados del más reciente al más antiguo.
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
 * Restaura la base de datos SQLite a partir de un archivo de respaldo ubicado en `env.BACKUPS_DIR`.
 * Genera un respaldo preventivo automático antes de sobrescribir.
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

/**
 * Ejecuta un respaldo inicial al arrancar y programa respaldos rotativos cada `intervalMinutes` (30 min por defecto).
 */
export async function startScheduledBackups(
  intervalMinutes = env.BACKUP_INTERVAL_MINUTES
): Promise<void> {
  try {
    const initial = await createDatabaseBackup('startup');
    console.log(`[Backup] Respaldo automático inicial creado: ${initial.filename}`);
  } catch (error) {
    console.warn('[Backup] No se pudo crear el respaldo inicial:', error);
  }

  if (backupIntervalHandle) {
    clearInterval(backupIntervalHandle);
  }

  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  backupIntervalHandle = setInterval(() => {
    void createDatabaseBackup('auto')
      .then((info) => {
        console.log(`[Backup] Respaldo programado creado: ${info.filename}`);
      })
      .catch((error) => {
        console.error('[Backup] Error en respaldo automático:', error);
      });
  }, intervalMs);

  // Evitar que el temporizador bloquee el cierre limpio del proceso
  backupIntervalHandle.unref();
}

export function stopScheduledBackups(): void {
  if (backupIntervalHandle) {
    clearInterval(backupIntervalHandle);
    backupIntervalHandle = null;
  }
}
