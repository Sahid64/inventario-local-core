// ============================================================================
// Enumeraciones y tipos de dominio (alineados con prisma/schema.prisma)
// ============================================================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export type MovementType = 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';

export type PartnerType = 'SUPPLIER' | 'CUSTOMER' | 'BOTH';

export type ProductUnit = 'PZA' | 'KG' | 'LT' | 'CAJA' | string;

// ============================================================================
// Entidades principales
// ============================================================================

export interface AppSettings {
  id: number;
  companyName: string;
  taxId: string | null;
  currencySymbol: string;
  taxRate: number;
  primaryColor: string;
  logoPath: string | null;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokenPayload {
  sub: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  attributes: string | null; // JSON string: {"color": "Negro", "talla": "M"}
  costPrice: number;
  salePrice: number;
  minStock: number;
  maxStock: number | null;
  stocks?: StockLevel[];
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  unit: ProductUnit;
  isActive: boolean;
  categoryId: string | null;
  category?: Category | null;
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface StockLevel {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  variant?: ProductVariant;
  warehouse?: Warehouse;
}

export interface InventoryMovement {
  id: string;
  type: MovementType;
  reason: string | null;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  referenceDoc: string | null;
  notes: string | null;
  variantId: string;
  warehouseId: string;
  userId: string;
  createdAt: string;
  variant?: ProductVariant & { product?: Pick<Product, 'id' | 'name' | 'unit'> };
  warehouse?: Pick<Warehouse, 'id' | 'name'>;
  user?: Pick<User, 'id' | 'username' | 'fullName'>;
}

export interface Partner {
  id: string;
  type: PartnerType;
  name: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

// ============================================================================
// Respuestas HTTP estandarizadas
// ============================================================================

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
