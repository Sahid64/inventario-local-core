import {
  createPartnerSchema,
  partnerTypeSchema,
  updatePartnerSchema,
} from '@inventario-local/shared/schemas';
import { NextFunction, Request, Response } from 'express';
import { partnerService } from '../services/partner.service';

export class PartnerController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type =
        typeof req.query.type === 'string' && req.query.type !== ''
          ? partnerTypeSchema.parse(req.query.type)
          : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;

      const partners = await partnerService.listPartners({ type, search });
      res.status(200).json(partners);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partner = await partnerService.getPartnerById(req.params.id);
      res.status(200).json(partner);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createPartnerSchema.parse(req.body);
      const partner = await partnerService.createPartner(input);
      res.status(201).json(partner);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updatePartnerSchema.parse(req.body);
      const partner = await partnerService.updatePartner(req.params.id, input);
      res.status(200).json(partner);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await partnerService.deletePartner(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const partnerController = new PartnerController();
