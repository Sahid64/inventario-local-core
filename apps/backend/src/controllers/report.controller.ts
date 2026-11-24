import { NextFunction, Request, Response } from 'express';
import { reportService } from '../services/report.service';

export class ReportController {
  async dashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouseId =
        typeof req.query.warehouseId === 'string' && req.query.warehouseId !== ''
          ? req.query.warehouseId
          : undefined;
      const kpis = await reportService.getDashboardKpis(warehouseId);
      res.status(200).json(kpis);
    } catch (error) {
      next(error);
    }
  }

  async stock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rows = await reportService.getStockReport({
        warehouseId: typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined,
        categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
        lowStockOnly: req.query.lowStockOnly === 'true',
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      res.status(200).json(rows);
    } catch (error) {
      next(error);
    }
  }

  async exportStockCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csv = await reportService.exportStockCsv({
        warehouseId: typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined,
        categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
        lowStockOnly: req.query.lowStockOnly === 'true',
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });

      const dateTag = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="existencias_${dateTag}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  async exportMovementsCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const csv = await reportService.exportMovementsCsv({
        warehouseId: typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined,
        variantId: typeof req.query.variantId === 'string' ? req.query.variantId : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
      });

      const dateTag = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="kardex_${dateTag}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export const reportController = new ReportController();
