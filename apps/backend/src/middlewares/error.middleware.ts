import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code = 'AppError',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(
    new AppError(
      404,
      `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
      'NotFound'
    )
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Errores controlados de dominio / aplicación
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  // 2. Errores de validación Zod
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      error: 'ValidationError',
      message: 'Los datos enviados no son válidos.',
      details,
    });
    return;
  }

  // 3. Errores conocidos de Prisma / SQLite
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(', ')
        : String(err.meta?.target ?? 'campo único');
      res.status(409).json({
        error: 'UniqueConstraintError',
        message: `Ya existe un registro con el mismo valor en: ${target}.`,
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'RecordNotFound',
        message: 'El registro solicitado no existe.',
      });
      return;
    }

    if (err.code === 'P2003') {
      res.status(400).json({
        error: 'ForeignKeyConstraintError',
        message: 'No se puede completar la operación porque existe una referencia inválida o relacionada.',
      });
      return;
    }
  }

  // 4. Errores de JWT
  if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
    res.status(401).json({
      error: err.name,
      message:
        err.name === 'TokenExpiredError'
          ? 'La sesión ha expirado. Inicia sesión nuevamente.'
          : 'Token de autenticación inválido.',
    });
    return;
  }

  // 5. Errores de sintaxis JSON mal formado
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json({
      error: 'InvalidJson',
      message: 'El cuerpo JSON de la petición está mal formado.',
    });
    return;
  }

  // 6. Error inesperado / genérico
  console.error('[UnhandledError]', err);

  const message =
    err instanceof Error && env.NODE_ENV !== 'production'
      ? err.message
      : 'Error interno del servidor.';

  res.status(500).json({
    error: 'InternalServerError',
    message,
  });
}
