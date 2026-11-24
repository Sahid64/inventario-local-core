import { updateSettingsSchema } from '@inventario-local/shared/schemas';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { settingsService } from '../services/settings.service';
import {
  createDatabaseBackup,
  listDatabaseBackups,
  restoreDatabaseBackup,
} from '../utils/backup.util';

const uploadLogoSchema = z.object({
  dataUrl: z.string().min(10, 'Imagen requerida en formato Data URL'),
});

const restoreBackupSchema = z.object({
  filename: z.string().min(4, 'Nombre de respaldo requerido'),
});

export class SettingsController {
  async getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      res.status(200).json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateSettingsSchema.parse(req.body);
      const settings = await settingsService.updateSettings(input);
      res.status(200).json(settings);
    } catch (error) {
      next(error);
    }
  }

  async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dataUrl } = uploadLogoSchema.parse(req.body);
      const settings = await settingsService.uploadLogo(dataUrl);
      res.status(200).json(settings);
    } catch (error) {
      next(error);
    }
  }

  async resetDemo(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await settingsService.resetDemoData();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async listBackups(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const backups = await listDatabaseBackups();
      res.status(200).json(backups);
    } catch (error) {
      next(error);
    }
  }

  async createBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const label = typeof req.body?.label === 'string' ? req.body.label : undefined;
      const backup = await createDatabaseBackup(label);
      res.status(201).json(backup);
    } catch (error) {
      next(error);
    }
  }

  async restoreBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = restoreBackupSchema.parse(req.body);
      const result = await restoreDatabaseBackup(filename);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
