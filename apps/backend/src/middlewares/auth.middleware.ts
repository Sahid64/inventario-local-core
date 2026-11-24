import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { AppError } from './error.middleware';

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

interface JwtPayloadShape {
  sub: string;
  username: string;
  fullName: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware de autenticación: valida el token Bearer JWT y verifica que el usuario
 * exista y permanezca activo en la base de datos local.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Token de autenticación requerido.', 'Unauthorized');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(401, 'Token de autenticación vacío.', 'Unauthorized');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayloadShape;

    if (!decoded?.sub) {
      throw new AppError(401, 'Token de autenticación inválido.', 'Unauthorized');
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      throw new AppError(401, 'Usuario inactivo o inexistente.', 'Unauthorized');
    }

    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      fullName: dbUser.fullName,
      role: dbUser.role as UserRole,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware RBAC: restringe el acceso a los roles especificados.
 * Debe ejecutarse después de `authenticate`.
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Sesión no autenticada.', 'Unauthorized'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          403,
          `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.`,
          'Forbidden'
        )
      );
      return;
    }

    next();
  };
}
