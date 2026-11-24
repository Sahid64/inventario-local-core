import type { UpdateSettingsInput } from '@inventario-local/shared/schemas';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../middlewares/error.middleware';

const ALLOWED_LOGO_MIMES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export class SettingsService {
  async getSettings() {
    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        companyName: 'Mi Empresa S.A.',
        currencySymbol: '$',
        taxRate: 0.16,
        primaryColor: '#0F172A',
      },
    });

    return settings;
  }

  async updateSettings(input: UpdateSettingsInput) {
    await this.getSettings();

    return prisma.appSettings.update({
      where: { id: 1 },
      data: {
        ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.currencySymbol !== undefined ? { currencySymbol: input.currencySymbol } : {}),
        ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        ...(input.logoPath !== undefined ? { logoPath: input.logoPath } : {}),
      },
    });
  }

  /**
   * Guarda un logo codificado en Data URL (base64) en `/uploads` y actualiza `AppSettings.logoPath`.
   */
  async uploadLogo(dataUrl: string) {
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl.trim());
    if (!match) {
      throw new AppError(400, 'Formato de imagen inválido. Envía un Data URL base64 válido.', 'InvalidLogoFormat');
    }

    const mime = match[1].toLowerCase();
    const ext = ALLOWED_LOGO_MIMES[mime];
    if (!ext) {
      throw new AppError(
        400,
        'Tipo de imagen no soportado. Usa PNG, JPG, WEBP o SVG.',
        'UnsupportedLogoType'
      );
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 2 * 1024 * 1024) {
      throw new AppError(400, 'El logo no puede exceder los 2 MB.', 'LogoTooLarge');
    }

    await fs.mkdir(env.UPLOADS_DIR, { recursive: true });
    const filename = `company-logo-${Date.now()}.${ext}`;
    const filePath = path.join(env.UPLOADS_DIR, filename);
    await fs.writeFile(filePath, buffer);

    const logoPath = `/uploads/${filename}`;
    return this.updateSettings({ logoPath });
  }

  /**
   * Reinicia la base de datos local con los datos iniciales definidos en `prisma/seed.ts`.
   */
  async resetDemoData() {
    return prisma.$transaction(async (tx) => {
      // 1. Limpiar en orden respetando llaves foráneas
      await tx.inventoryMovement.deleteMany();
      await tx.stockLevel.deleteMany();
      await tx.productVariant.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.partner.deleteMany();
      await tx.warehouse.deleteMany();
      await tx.user.deleteMany();

      // 2. Restaurar configuración inicial White-Label (igual que seed.ts)
      const settings = await tx.appSettings.upsert({
        where: { id: 1 },
        update: {
          companyName: 'Comercializadora Demo',
          taxId: null,
          currencySymbol: '$',
          taxRate: 0.16,
          primaryColor: '#2563EB',
          logoPath: null,
        },
        create: {
          id: 1,
          companyName: 'Comercializadora Demo',
          currencySymbol: '$',
          taxRate: 0.16,
          primaryColor: '#2563EB',
        },
      });

      // 3. Usuario Administrador por defecto (igual que seed.ts)
      const admin = await tx.user.create({
        data: {
          username: 'admin',
          fullName: 'Administrador General',
          passwordHash: '123456',
          role: 'ADMIN',
          isActive: true,
        },
        select: { id: true, username: true, fullName: true, role: true },
      });

      // 4. Almacén Principal
      const mainWarehouse = await tx.warehouse.create({
        data: {
          name: 'Almacén Central',
          location: 'Planta Baja - Zona A',
          isDefault: true,
        },
      });

      // 5. Categoría y Producto de ejemplo
      const cat = await tx.category.create({
        data: {
          name: 'General',
          description: 'Artículos estándar de catálogo',
        },
      });

      const product = await tx.product.create({
        data: {
          name: 'Artículo Estándar de Muestra',
          unit: 'PZA',
          categoryId: cat.id,
          variants: {
            create: {
              sku: 'SKU-0001',
              barcode: '750100000001',
              costPrice: 100,
              salePrice: 150,
              minStock: 10,
            },
          },
        },
        include: { variants: true },
      });

      return {
        message: 'Datos de demostración restaurados correctamente.',
        settings,
        admin,
        mainWarehouse,
        product,
      };
    });
  }
}

export const settingsService = new SettingsService();
