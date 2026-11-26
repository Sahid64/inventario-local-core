import cors from 'cors';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { AppError, errorHandler, notFoundHandler } from './middlewares/error.middleware';
import apiRoutes from './routes/index';

const app = express();

// Seguridad HTTP (permitiendo recursos cross-origin para logos locales en escritorio)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS para entorno local y ventana de escritorio (file:// / 127.0.0.1)
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-app-secret'],
  })
);

// Parsers de cuerpo de petición
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos locales (logos White-Label)
app.use('/uploads', express.static(env.UPLOADS_DIR));

// Endpoint de salud del servidor local (utilizado por Electron para verificar arranque)
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'inventario-local-core',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Validación de secreto de aplicación de escritorio (`x-app-secret`).
 * Cuando `APP_SECRET` está definido (inyectado al arrancar Electron), bloquea cualquier
 * petición local externa que no incluya el encabezado exacto.
 */
function verifyAppSecret(req: Request, _res: Response, next: NextFunction): void {
  if (!env.APP_SECRET || req.method === 'OPTIONS') {
    next();
    return;
  }

  const provided = req.header('x-app-secret') ?? '';
  const expectedBuf = Buffer.from(env.APP_SECRET, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    next(
      new AppError(
        403,
        'Acceso denegado: encabezado x-app-secret inválido o ausente.',
        'InvalidAppSecret'
      )
    );
    return;
  }

  next();
}

// Rutas REST principales (/api/v1/...) protegidas por x-app-secret
app.use('/api/v1', verifyAppSecret, apiRoutes);

// Manejo de rutas no encontradas y captura global de errores
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;
