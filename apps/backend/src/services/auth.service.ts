import type { CreateUserInput, LoginInput, UpdateUserInput } from '@inventario-local/shared/schemas';
import type { UserRole } from '@inventario-local/shared/types';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';

const BCRYPT_ROUNDS = 10;

const safeUserSelect = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export class AuthService {
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'Usuario o contraseña incorrectos.', 'InvalidCredentials');
    }

    let isValid = false;

    if (isBcryptHash(user.passwordHash)) {
      isValid = await bcrypt.compare(input.password, user.passwordHash);
    } else {
      // Compatibilidad con el usuario inicial creado por seed.ts (texto plano en demo)
      isValid = user.passwordHash === input.password;
      if (isValid) {
        const upgradedHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: upgradedHash },
        });
      }
    }

    if (!isValid) {
      throw new AppError(401, 'Usuario o contraseña incorrectos.', 'InvalidCredentials');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as UserRole,
    };

    const signOptions: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    };

    const token = jwt.sign(payload, env.JWT_SECRET, signOptions);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role as UserRole,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });

    if (!user) {
      throw new AppError(404, 'Usuario no encontrado.', 'UserNotFound');
    }

    return user;
  }

  async listUsers() {
    return prisma.user.findMany({
      select: safeUserSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(input: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (existing) {
      throw new AppError(409, `El usuario "${input.username}" ya existe.`, 'UserAlreadyExists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    return prisma.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        passwordHash,
        role: input.role,
        isActive: input.isActive,
      },
      select: safeUserSelect,
    });
  }

  async updateUser(id: string, input: UpdateUserInput) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Usuario no encontrado.', 'UserNotFound');
    }

    // Evitar desactivar o degradar al último administrador activo
    if (
      existing.role === 'ADMIN' &&
      (input.isActive === false || (input.role && input.role !== 'ADMIN'))
    ) {
      const otherActiveAdmins = await prisma.user.count({
        where: {
          role: 'ADMIN',
          isActive: true,
          NOT: { id },
        },
      });
      if (otherActiveAdmins === 0) {
        throw new AppError(
          400,
          'Debe existir al menos un usuario administrador activo en el sistema.',
          'LastAdminProtection'
        );
      }
    }

    const data: {
      fullName?: string;
      role?: string;
      isActive?: boolean;
      passwordHash?: string;
    } = {};

    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.password !== undefined) {
      data.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }

    return prisma.user.update({
      where: { id },
      data,
      select: safeUserSelect,
    });
  }

  async deleteUser(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new AppError(400, 'No puedes eliminar tu propio usuario activo.', 'SelfDeleteNotAllowed');
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Usuario no encontrado.', 'UserNotFound');
    }

    const movementsCount = await prisma.inventoryMovement.count({ where: { userId: id } });
    if (movementsCount > 0) {
      // Si tiene movimientos en el Kardex, solo se desactiva para preservar integridad histórica
      return prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: safeUserSelect,
      });
    }

    await prisma.user.delete({ where: { id } });
    return { deleted: true, id };
  }
}

export const authService = new AuthService();
