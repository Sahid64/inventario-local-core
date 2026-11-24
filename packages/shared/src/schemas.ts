import { z } from 'zod';

// ============================================================================
// Primitivos y enums compartidos
// ============================================================================

export const userRoleSchema = z.enum(['ADMIN', 'MANAGER', 'OPERATOR']);
export const movementTypeSchema = z.enum(['IN', 'OUT', 'ADJUST']);
export const fullMovementTypeSchema = z.enum(['IN', 'OUT', 'ADJUST', 'TRANSFER']);
export const partnerTypeSchema = z.enum(['SUPPLIER', 'CUSTOMER', 'BOTH']);

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((val) => (val === '' ? undefined : val))
  .optional();

const hexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/, 'Debe ser un color hexadecimal válido (ej. #2563EB)');

// ============================================================================
// Autenticación y Usuarios
// ============================================================================

export const loginSchema = z.object({
  username: z.string().trim().min(2, 'El usuario debe tener al menos 2 caracteres'),
  password: z.string().min(4, 'La contraseña debe tener al menos 4 caracteres'),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(50, 'Máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, puntos, guiones y guion bajo'),
  fullName: z.string().trim().min(2, 'El nombre completo es obligatorio').max(120),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: userRoleSchema.default('OPERATOR'),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(6).optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// Categorías, Productos y Variantes
// ============================================================================

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'El nombre de la categoría es obligatorio').max(100),
  description: optionalTrimmedString,
});

export const updateCategorySchema = createCategorySchema.partial();

export const createVariantSchema = z
  .object({
    sku: z.string().trim().min(2, 'El SKU es obligatorio').max(64),
    barcode: optionalTrimmedString,
    attributes: z
      .union([z.string().trim(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))])
      .optional()
      .transform((val) => {
        if (val === undefined || val === '') return undefined;
        return typeof val === 'string' ? val : JSON.stringify(val);
      }),
    costPrice: z.coerce.number().min(0, 'El costo no puede ser negativo').default(0),
    salePrice: z.coerce.number().min(0, 'El precio de venta no puede ser negativo').default(0),
    minStock: z.coerce.number().int().min(0, 'El stock mínimo no puede ser negativo').default(5),
    maxStock: z.coerce.number().int().min(0).optional().nullable(),
  })
  .refine(
    (data) => data.maxStock === undefined || data.maxStock === null || data.maxStock >= data.minStock,
    {
      message: 'El stock máximo debe ser mayor o igual al stock mínimo',
      path: ['maxStock'],
    }
  );

export const updateVariantSchema = z
  .object({
    sku: z.string().trim().min(2).max(64).optional(),
    barcode: z.string().trim().nullable().optional(),
    attributes: z
      .union([
        z.string().trim(),
        z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
        z.null(),
      ])
      .optional()
      .transform((val) => {
        if (val === undefined || val === null) return val;
        return typeof val === 'string' ? val : JSON.stringify(val);
      }),
    costPrice: z.coerce.number().min(0).optional(),
    salePrice: z.coerce.number().min(0).optional(),
    minStock: z.coerce.number().int().min(0).optional(),
    maxStock: z.coerce.number().int().min(0).nullable().optional(),
  })
  .refine(
    (data) =>
      data.maxStock === undefined ||
      data.maxStock === null ||
      data.minStock === undefined ||
      data.maxStock >= data.minStock,
    {
      message: 'El stock máximo debe ser mayor o igual al stock mínimo',
      path: ['maxStock'],
    }
  );

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del producto es obligatorio').max(160),
  description: optionalTrimmedString,
  unit: z.string().trim().min(1).max(20).default('PZA'),
  isActive: z.boolean().default(true),
  categoryId: z.string().uuid('ID de categoría inválido').optional().nullable(),
  variants: z
    .array(createVariantSchema)
    .min(1, 'Todo producto debe tener al menos una variante/SKU'),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().nullable().optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().uuid('ID de categoría inválido').nullable().optional(),
});

// ============================================================================
// Almacenes y Movimientos de Inventario (Kardex)
// ============================================================================

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del almacén es obligatorio').max(120),
  location: optionalTrimmedString,
  isDefault: z.boolean().default(false),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const registerMovementSchema = z
  .object({
    variantId: z.string().uuid('ID de variante inválido'),
    warehouseId: z.string().uuid('ID de almacén inválido'),
    type: movementTypeSchema,
    quantity: z.coerce.number().min(0, 'La cantidad no puede ser negativa'),
    unitCost: z.coerce.number().min(0, 'El costo unitario no puede ser negativo').optional(),
    reason: optionalTrimmedString,
    referenceDoc: optionalTrimmedString,
    notes: optionalTrimmedString,
  })
  .refine((data) => (data.type === 'ADJUST' ? data.quantity >= 0 : data.quantity > 0), {
    message: 'Para entradas y salidas la cantidad debe ser mayor a 0',
    path: ['quantity'],
  });

export const transferStockSchema = z
  .object({
    variantId: z.string().uuid('ID de variante inválido'),
    fromWarehouseId: z.string().uuid('ID de almacén origen inválido'),
    toWarehouseId: z.string().uuid('ID de almacén destino inválido'),
    quantity: z.coerce.number().positive('La cantidad a traspasar debe ser mayor a 0'),
    referenceDoc: optionalTrimmedString,
    notes: optionalTrimmedString,
  })
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'El almacén origen y destino deben ser distintos',
    path: ['toWarehouseId'],
  });

export const movementQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  type: fullMovementTypeSchema.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ============================================================================
// Terceros (Proveedores y Clientes)
// ============================================================================

export const createPartnerSchema = z.object({
  type: partnerTypeSchema,
  name: z.string().trim().min(2, 'El nombre o razón social es obligatorio').max(160),
  taxId: optionalTrimmedString,
  phone: optionalTrimmedString,
  email: z
    .string()
    .trim()
    .email('Correo electrónico inválido')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  address: optionalTrimmedString,
});

export const updatePartnerSchema = createPartnerSchema.partial();

// ============================================================================
// Configuración White-Label (AppSettings)
// ============================================================================

export const updateSettingsSchema = z.object({
  companyName: z.string().trim().min(2, 'El nombre de la empresa es obligatorio').max(140).optional(),
  taxId: z.string().trim().max(50).nullable().optional(),
  currencySymbol: z.string().trim().min(1).max(5).optional(),
  taxRate: z.coerce.number().min(0, 'El impuesto no puede ser negativo').max(1, 'Use formato decimal (ej. 0.16 para 16%)').optional(),
  primaryColor: hexColorSchema.optional(),
  logoPath: z.string().trim().nullable().optional(),
});

// ============================================================================
// Tipos inferidos desde Zod
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type RegisterMovementInput = z.infer<typeof registerMovementSchema>;
export type TransferStockInput = z.infer<typeof transferStockSchema>;
export type MovementQueryInput = z.infer<typeof movementQuerySchema>;
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
