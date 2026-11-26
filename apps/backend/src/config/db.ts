import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { env } from './env';

// Asegurar que el directorio de datos exista antes de inicializar SQLite
fs.mkdirSync(path.dirname(env.DB_FILE_PATH), { recursive: true });
fs.mkdirSync(env.BACKUPS_DIR, { recursive: true });
fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Inicializa la conexión con SQLite con máxima protección ante apagones:
 * - journal_mode = WAL (lectura/escritura concurrente y recuperación atómica)
 * - synchronous = FULL (garantiza escritura física en disco antes de confirmar commit)
 * - foreign_keys = ON (integridad referencial estricta)
 * - busy_timeout = 5000 (espera ante bloqueos breves)
 */
export async function initDatabase(): Promise<void> {
  await prisma.$connect();

  const journalResult = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>(
    'PRAGMA journal_mode = WAL;'
  );
  await prisma.$queryRawUnsafe('PRAGMA synchronous = FULL;');
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');

  const mode = journalResult?.[0]?.journal_mode ?? 'unknown';
  console.log(
    `[DB] SQLite conectado en ${env.DB_FILE_PATH} (journal_mode=${mode}, synchronous=FULL, foreign_keys=ON)`
  );
}

/**
 * Cierra limpiamente la conexión de Prisma ejecutando un checkpoint WAL previo.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Ignorar si la conexión ya estaba cerrada
  }
  await prisma.$disconnect();
  console.log('[DB] Conexión SQLite cerrada correctamente');
}
