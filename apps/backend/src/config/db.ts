import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Inicializa la conexión con SQLite y activa el modo WAL (Write-Ahead Logging)
 * junto con llaves foráneas y tiempo de espera para concurrencia local/LAN.
 */
export async function initDatabase(): Promise<void> {
  await prisma.$connect();

  const journalResult = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>(
    'PRAGMA journal_mode = WAL;'
  );
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');

  const mode = journalResult?.[0]?.journal_mode ?? 'unknown';
  console.log(`[DB] SQLite conectado (journal_mode=${mode})`);
}

/**
 * Cierra limpiamente la conexión de Prisma.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('[DB] Conexión SQLite cerrada correctamente');
}
