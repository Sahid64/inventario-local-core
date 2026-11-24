import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import apiRoutes from './routes/index';

const app = express();

// Seguridad HTTP (permitiendo recursos cross-origin para logos White-Label en LAN/Tauri)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configurado para entorno local, red LAN o contenedor Tauri
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

// Parsers de cuerpo de petición
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos locales (logos White-Label, exportaciones temporales)
app.use('/uploads', express.static(env.UPLOADS_DIR));

// Endpoint de salud del servidor local
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'inventario-local-core',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Rutas REST principales (/api/v1/...)
app.use('/api/v1', apiRoutes);

// Manejo de rutas no encontradas y captura global de errores
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
export default app;
