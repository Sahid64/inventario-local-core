import 'dotenv/config';
import path from 'path';

const backendRoot = path.resolve(__dirname, '../..');

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3001),
  HOST: process.env.HOST ?? '0.0.0.0',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  JWT_SECRET: process.env.JWT_SECRET ?? 'inventario-local-dev-secret-change-in-prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '12h',
  DB_FILE_PATH:
    process.env.DB_FILE_PATH ?? path.join(backendRoot, 'prisma', 'inventario_local.db'),
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? path.join(backendRoot, 'uploads'),
  BACKUPS_DIR: process.env.BACKUPS_DIR ?? path.join(backendRoot, 'backups'),
} as const;
