import {
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
  updateCategorySchema,
  updateProductSchema,
  updateVariantSchema,
} from '@inventario-local/shared/schemas';
import { NextFunction, Request, Response } from 'express';
import { catalogService } from '../services/catalog.service';

export class CatalogController {
  // Categorías
  async listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await catalogService.listCategories();
      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createCategorySchema.parse(req.body);
      const category = await catalogService.createCategory(input);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateCategorySchema.parse(req.body);
      const category = await catalogService.updateCategory(req.params.id, input);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.deleteCategory(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Productos
  async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await catalogService.listProducts({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        categoryId: typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined,
        warehouseId: typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined,
        includeInactive: req.query.includeInactive === 'true',
      });
      res.status(200).json(products);
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await catalogService.getProductById(req.params.id);
      res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  }

  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createProductSchema.parse(req.body);
      const product = await catalogService.createProduct(input);
      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateProductSchema.parse(req.body);
      const product = await catalogService.updateProduct(req.params.id, input);
      res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.deleteProduct(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Variantes / SKUs
  async addVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createVariantSchema.parse(req.body);
      const variant = await catalogService.addVariant(req.params.id, input);
      res.status(201).json(variant);
    } catch (error) {
      next(error);
    }
  }

  async updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateVariantSchema.parse(req.body);
      const variant = await catalogService.updateVariant(req.params.variantId, input);
      res.status(200).json(variant);
    } catch (error) {
      next(error);
    }
  }

  async deleteVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await catalogService.deleteVariant(req.params.variantId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Escaneo rápido y generación de códigos
  async scanCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const warehouseId =
        typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined;
      const variant = await catalogService.findVariantByCode(req.params.code, warehouseId);
      res.status(200).json(variant);
    } catch (error) {
      next(error);
    }
  }

  async generateBarcode(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const barcode = await catalogService.generateUniqueBarcode();
      res.status(200).json({ barcode, format: 'EAN-13' });
    } catch (error) {
      next(error);
    }
  }
}

export const catalogController = new CatalogController();
