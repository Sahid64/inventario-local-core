import http from 'http';
import { app } from './app';
import { disconnectDatabase, initDatabase } from './config/db';
import { env } from './config/env';

let server: http.Server | null = null;

async function bootstrap(): Promise<void> {
  try {
    await initDatabase();

    server = app.listen(env.PORT, env.HOST, () => {
      console.log(
        `[Server] API Inventario Local escuchando en http://${env.HOST}:${env.PORT} (${env.NODE_ENV})`
      );
    });
  } catch (error) {
    console.error('[Server] Error crítico al iniciar el servidor:', error);
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Señal ${signal} recibida. Cerrando servidor local...`);

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
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
