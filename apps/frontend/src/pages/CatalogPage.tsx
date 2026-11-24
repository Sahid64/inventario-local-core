import type { Category, Product, ProductVariant } from '@inventario-local/shared/types';
import {
  Barcode,
  Edit2,
  FolderPlus,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '../components/ThemeProvider';
import { Badge, Button, Card, inputClassName, Modal } from '../components/ui';
import { api, extractApiError } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

interface VariantFormRow {
  id?: string;
  sku: string;
  barcode: string;
  attributes: string;
  costPrice: number;
  salePrice: number;
  minStock: number;
  maxStock: string;
}

const emptyVariant = (): VariantFormRow => ({
  sku: '',
  barcode: '',
  attributes: '',
  costPrice: 0,
  salePrice: 0,
  minStock: 5,
  maxStock: '',
});

export const CatalogPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Producto
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('PZA');
  const [categoryId, setCategoryId] = useState('');
  const [variants, setVariants] = useState<VariantFormRow[]>([emptyVariant()]);
  const [saving, setSaving] = useState(false);

  // Modal Categoría
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Modal Etiqueta / Impresión
  const [labelTarget, setLabelTarget] = useState<{
    productName: string;
    variant: ProductVariant;
  } | null>(null);

  const canManage = useAuthStore((s) => s.hasRole('ADMIN', 'MANAGER'));
  const activeWarehouseId = useSettingsStore((s) => s.activeWarehouseId);
  const settings = useSettingsStore((s) => s.settings);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get<Product[]>('/catalog/products', {
          params: {
            ...(search ? { search } : {}),
            ...(categoryFilter ? { categoryId: categoryFilter } : {}),
            ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
          },
        }),
        api.get<Category[]>('/catalog/categories'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      setError(extractApiError(err, 'No se pudo cargar el catálogo.'));
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, activeWarehouseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setUnit('PZA');
    setCategoryId(categories[0]?.id ?? '');
    setVariants([emptyVariant()]);
    setProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description ?? '');
    setUnit(product.unit);
    setCategoryId(product.categoryId ?? '');
    setVariants(
      (product.variants ?? []).map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode ?? '',
        attributes: v.attributes ?? '',
        costPrice: v.costPrice,
        salePrice: v.salePrice,
        minStock: v.minStock,
        maxStock: v.maxStock !== null && v.maxStock !== undefined ? String(v.maxStock) : '',
      }))
    );
    setProductModalOpen(true);
  };

  const handleGenerateBarcode = async (index: number) => {
    try {
      const { data } = await api.get<{ barcode: string }>('/catalog/barcode/generate');
      setVariants((prev) =>
        prev.map((row, i) => (i === index ? { ...row, barcode: data.barcode } : row))
      );
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!editingProduct) {
        await api.post('/catalog/products', {
          name,
          description: description || undefined,
          unit,
          categoryId: categoryId || null,
          variants: variants.map((v) => ({
            sku: v.sku,
            barcode: v.barcode || undefined,
            attributes: v.attributes || undefined,
            costPrice: Number(v.costPrice),
            salePrice: Number(v.salePrice),
            minStock: Number(v.minStock),
            maxStock: v.maxStock ? Number(v.maxStock) : null,
          })),
        });
      } else {
        await api.patch(`/catalog/products/${editingProduct.id}`, {
          name,
          description: description || null,
          unit,
          categoryId: categoryId || null,
        });

        for (const v of variants) {
          const payload = {
            sku: v.sku,
            barcode: v.barcode || null,
            attributes: v.attributes || null,
            costPrice: Number(v.costPrice),
            salePrice: Number(v.salePrice),
            minStock: Number(v.minStock),
            maxStock: v.maxStock ? Number(v.maxStock) : null,
          };
          if (v.id) {
            await api.patch(`/catalog/variants/${v.id}`, payload);
          } else {
            await api.post(`/catalog/products/${editingProduct.id}/variants`, {
              ...payload,
              barcode: v.barcode || undefined,
              attributes: v.attributes || undefined,
            });
          }
        }
      }

      setProductModalOpen(false);
      await loadData();
    } catch (err) {
      setError(extractApiError(err, 'Error al guardar el producto.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`¿Eliminar o archivar "${product.name}"?`)) return;
    try {
      await api.delete(`/catalog/products/${product.id}`);
      await loadData();
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/catalog/categories', { name: catName, description: catDesc || undefined });
      setCatName('');
      setCatDesc('');
      setCatModalOpen(false);
      await loadData();
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const totalVariantStock = (variant: ProductVariant) =>
    (variant.stocks ?? []).reduce((acc, s) => acc + s.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Catálogo de Productos</h1>
          <p className="text-sm text-slate-500">
            Administra productos, variantes/SKUs, precios, códigos de barras y stock mínimo.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCatModalOpen(true)}>
              <FolderPlus className="h-4 w-4" />
              Nueva categoría
            </Button>
            <Button size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o código de barras..."
              className={`${inputClassName} pl-9`}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={inputClassName}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Producto / Categoría</th>
                <th className="px-4 py-3">SKU / Código</th>
                <th className="px-4 py-3 text-right">Costo</th>
                <th className="px-4 py-3 text-right">Precio Venta</th>
                <th className="px-4 py-3 text-right">Existencia</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    Cargando catálogo...
                  </td>
                </tr>
              ) : !products.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    No se encontraron productos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                products.flatMap((product) =>
                  (product.variants ?? []).map((variant, idx) => {
                    const qty = totalVariantStock(variant);
                    const isLow = qty <= variant.minStock;
                    return (
                      <tr key={variant.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">{product.name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            <span>{product.category?.name ?? 'Sin categoría'}</span>
                            <span>·</span>
                            <span>{product.unit}</span>
                            {variant.attributes && (
                              <span className="truncate text-slate-400">{variant.attributes}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-semibold text-slate-800">
                            {variant.sku}
                          </p>
                          {variant.barcode && (
                            <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-500">
                              <Barcode className="h-3 w-3" />
                              {variant.barcode}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatMoney(variant.costPrice, settings.currencySymbol)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatMoney(variant.salePrice, settings.currencySymbol)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge tone={isLow ? 'warning' : 'success'}>
                            {qty} {product.unit}
                          </Badge>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Min: {variant.minStock}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title="Imprimir etiqueta"
                              onClick={() =>
                                setLabelTarget({ productName: product.name, variant })
                              }
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                            {canManage && idx === 0 && (
                              <>
                                <button
                                  type="button"
                                  title="Editar producto"
                                  onClick={() => openEditModal(product)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Eliminar / Archivar"
                                  onClick={() => void handleDeleteProduct(product)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Crear / Editar Producto */}
      <Modal
        open={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        subtitle="Configura los datos generales y una o más variantes con SKU y código de barras."
        maxWidthClass="max-w-3xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Nombre del producto *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClassName}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Unidad de medida
              </label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClassName}>
                <option value="PZA">PZA (Pieza)</option>
                <option value="KG">KG (Kilogramo)</option>
                <option value="LT">LT (Litro)</option>
                <option value="CAJA">CAJA</option>
                <option value="PAQ">PAQ (Paquete)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClassName}
              />
            </div>
          </div>

          {/* Variantes dinámicas */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Variantes / SKUs</h4>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar variante
              </Button>
            </div>

            {variants.map((row, idx) => (
              <div
                key={row.id ?? idx}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">SKU *</label>
                    <input
                      type="text"
                      required
                      value={row.sku}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, sku: e.target.value } : r))
                        )
                      }
                      placeholder="SKU-0002"
                      className={inputClassName}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Código de barras (EAN-13 / Code128)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={row.barcode}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, barcode: e.target.value } : r))
                          )
                        }
                        placeholder="Escanea o genera un código interno"
                        className={inputClassName}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleGenerateBarcode(idx)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Generar
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Costo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.costPrice}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, costPrice: Number(e.target.value) } : r
                          )
                        )
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Precio Venta
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.salePrice}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, salePrice: Number(e.target.value) } : r
                          )
                        )
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Stock Mínimo
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={row.minStock}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, minStock: Number(e.target.value) } : r
                          )
                        )
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Atributos (JSON)
                    </label>
                    <input
                      type="text"
                      value={row.attributes}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, attributes: e.target.value } : r))
                        )
                      }
                      placeholder='{"color":"Negro"}'
                      className={inputClassName}
                    />
                  </div>
                </div>

                {variants.length > 1 && !row.id && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs font-medium text-rose-600 hover:underline"
                    >
                      Quitar variante
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setProductModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar producto'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nueva Categoría */}
      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Nueva Categoría"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Nombre *</label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Descripción</label>
            <input
              type="text"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCatModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear categoría</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Impresión de Etiqueta */}
      <Modal
        open={Boolean(labelTarget)}
        onClose={() => setLabelTarget(null)}
        title="Etiqueta de Producto"
        maxWidthClass="max-w-sm"
      >
        {labelTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {settings.companyName}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">{labelTarget.productName}</p>
              <p className="mt-2 text-lg font-extrabold text-slate-900">
                {formatMoney(labelTarget.variant.salePrice, settings.currencySymbol)}
              </p>
              <div className="mt-3 flex flex-col items-center">
                <div className="flex h-12 items-end gap-[2px]">
                  {(labelTarget.variant.barcode || labelTarget.variant.sku)
                    .split('')
                    .map((ch, i) => (
                      <span
                        key={i}
                        className="inline-block bg-slate-900"
                        style={{
                          width: (ch.charCodeAt(0) % 3) + 1,
                          height: '100%',
                        }}
                      />
                    ))}
                </div>
                <p className="mt-1.5 font-mono text-xs tracking-widest text-slate-800">
                  {labelTarget.variant.barcode || labelTarget.variant.sku}
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  SKU: {labelTarget.variant.sku}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 no-print">
              <Button variant="secondary" onClick={() => setLabelTarget(null)}>
                Cerrar
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
