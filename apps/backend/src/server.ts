import http from 'http';
import { app } from './app';
import { disconnectDatabase, initDatabase } from './config/db';
import { env } from './config/env';
import { startScheduledBackups, stopScheduledBackups } from './utils/backup.util';

let server: http.Server | null = null;
let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  try {
    await initDatabase();
    await startScheduledBackups(env.BACKUP_INTERVAL_MINUTES);

    // Vinculado estrictamente a 127.0.0.1 para impedir accesos externos no autorizados
    server = app.listen(env.PORT, '127.0.0.1', () => {
      console.log(
        `[Server] API Inventario Local escuchando en http://127.0.0.1:${env.PORT} (${env.NODE_ENV}) [appSecret=${env.APP_SECRET ? 'ON' : 'OFF'}]`
      );
    });
  } catch (error) {
    console.error('[Server] Error crítico al iniciar el servidor:', error);
    stopScheduledBackups();
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Server] Señal ${signal} recibida. Cerrando servidor local...`);
  stopScheduledBackups();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    }).catch(() => undefined);
  }

  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void bootstrap();
