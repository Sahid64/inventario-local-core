import type { InventoryMovement, Product, ProductVariant } from '@inventario-local/shared/types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Barcode,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { Badge, Button, Card, inputClassName } from '../components/ui';
import { api, extractApiError } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

interface FlatVariant {
  id: string;
  sku: string;
  barcode: string | null;
  productName: string;
  unit: string;
  costPrice: number;
}

export const MovementsPage: React.FC = () => {
  const [variants, setVariants] = useState<FlatVariant[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario de movimiento
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [variantId, setVariantId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('Compra');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [notes, setNotes] = useState('');
  const [scanInput, setScanInput] = useState('');

  // Filtros Kardex
  const [filterType, setFilterType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const canAdjust = useAuthStore((s) => s.hasRole('ADMIN', 'MANAGER'));
  const { warehouses, activeWarehouseId } = useSettingsStore();

  useEffect(() => {
    if (activeWarehouseId) {
      setWarehouseId(activeWarehouseId);
    } else if (!warehouseId && warehouses.length > 0) {
      const def = warehouses.find((w) => w.isDefault) ?? warehouses[0];
      setWarehouseId(def.id);
    }
  }, [activeWarehouseId, warehouses, warehouseId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, movRes] = await Promise.all([
        api.get<Product[]>('/catalog/products'),
        api.get<{ data: InventoryMovement[]; total: number }>('/inventory/movements', {
          params: {
            ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
            ...(filterType ? { type: filterType } : {}),
            ...(fromDate ? { fromDate: new Date(fromDate).toISOString() } : {}),
            ...(toDate ? { toDate: new Date(`${toDate}T23:59:59`).toISOString() } : {}),
            limit: 100,
          },
        }),
      ]);

      const flat: FlatVariant[] = [];
      for (const p of prodRes.data) {
        for (const v of p.variants ?? []) {
          flat.push({
            id: v.id,
            sku: v.sku,
            barcode: v.barcode,
            productName: p.name,
            unit: p.unit,
            costPrice: v.costPrice,
          });
        }
      }

      setVariants(flat);
      if (!variantId && flat.length > 0) {
        setVariantId(flat[0].id);
        setUnitCost(String(flat[0].costPrice));
      }
      setMovements(movRes.data.data);
    } catch (err) {
      setError(extractApiError(err, 'No se pudo cargar el Kardex.'));
    } finally {
      setLoading(false);
    }
  }, [activeWarehouseId, filterType, fromDate, toDate, variantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBarcodeLookup = useCallback(async (code: string) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.get<ProductVariant & { product: { name: string } }>(
        `/catalog/scan/${encodeURIComponent(code)}`
      );
      setVariantId(data.id);
      setUnitCost(String(data.costPrice));
      setScanInput(code);
      setSuccessMsg(`Escaneado: ${data.product.name} (${data.sku})`);
    } catch (err) {
      setError(extractApiError(err, `Código "${code}" no encontrado.`));
    }
  }, []);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId),
    [variants, variantId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.post<{ newStock: number }>('/inventory/movements', {
        variantId,
        warehouseId,
        type,
        quantity: Number(quantity),
        unitCost: unitCost !== '' ? Number(unitCost) : undefined,
        reason: reason || undefined,
        referenceDoc: referenceDoc || undefined,
        notes: notes || undefined,
      });
      setSuccessMsg(`Movimiento registrado. Nuevo stock en almacén: ${data.newStock}`);
      setQuantity('1');
      setReferenceDoc('');
      setNotes('');
      await loadData();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo registrar el movimiento.'));
    } finally {
      setSubmitting(false);
    }
  };

  const movementTone = (mType: string) => {
    if (mType === 'IN') return 'success';
    if (mType === 'OUT') return 'danger';
    if (mType === 'ADJUST') return 'warning';
    return 'info';
  };

  return (
    <div className="space-y-6">
      <BarcodeScanner onScan={(code) => void handleBarcodeLookup(code)} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Movimientos y Kardex</h1>
          <p className="text-sm text-slate-500">
            Registra entradas, salidas o ajustes de inventario. Compatible con pistola lectora USB.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700">
          <Barcode className="h-3.5 w-3.5" />
          <span>Escáner USB activo</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Formulario rápido de registro */}
      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('IN');
                  setReason('Compra');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  type === 'IN'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                Entrada (IN)
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('OUT');
                  setReason('Venta');
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  type === 'OUT'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                Salida (OUT)
              </button>
              {canAdjust && (
                <button
                  type="button"
                  onClick={() => {
                    setType('ADJUST');
                    setReason('Conteo físico');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                    type === 'ADJUST'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Ajuste (ADJUST)
                </button>
              )}
            </div>

            {/* Búsqueda manual por código de barras / SKU */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && scanInput.trim()) {
                    e.preventDefault();
                    void handleBarcodeLookup(scanInput.trim());
                  }
                }}
                placeholder="Buscar SKU o código de barras..."
                className={`${inputClassName} w-56`}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => scanInput.trim() && void handleBarcodeLookup(scanInput.trim())}
              >
                Buscar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Producto / Variante *
              </label>
              <select
                required
                value={variantId}
                onChange={(e) => {
                  const id = e.target.value;
                  setVariantId(id);
                  const found = variants.find((v) => v.id === id);
                  if (found) setUnitCost(String(found.costPrice));
                }}
                className={inputClassName}
              >
                <option value="">Selecciona una variante...</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} — {v.productName} ({v.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Almacén *</label>
              <select
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className={inputClassName}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                {type === 'ADJUST' ? 'Conteo físico real *' : 'Cantidad *'}
              </label>
              <input
                type="number"
                required
                step="0.01"
                min={type === 'ADJUST' ? '0' : '0.01'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Motivo</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Compra, Venta, Merma..."
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Costo Unitario
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Folio / Referencia
              </label>
              <input
                type="text"
                value={referenceDoc}
                onChange={(e) => setReferenceDoc(e.target.value)}
                placeholder="FAC-1024, TICKET-09"
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Notas</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones opcionales"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-500">
              {selectedVariant
                ? `Seleccionado: ${selectedVariant.productName} (${selectedVariant.sku})`
                : 'Selecciona un SKU o escanea un código de barras'}
            </p>
            <Button type="submit" disabled={submitting || !variantId || !warehouseId}>
              {submitting ? 'Registrando...' : 'Aplicar movimiento'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Filtros e Historial Kardex */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Historial Kardex</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
            >
              <option value="">Todos los tipos</option>
              <option value="IN">IN (Entradas)</option>
              <option value="OUT">OUT (Salidas)</option>
              <option value="ADJUST">ADJUST (Ajustes)</option>
              <option value="TRANSFER">TRANSFER (Traspasos)</option>
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
            />
            <Button variant="secondary" size="sm" onClick={() => void loadData()}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Producto / SKU</th>
                <th className="px-4 py-3">Almacén</th>
                <th className="px-4 py-3 text-right">Cant.</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3">Motivo / Ref.</th>
                <th className="px-4 py-3">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!movements.length ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    No hay movimientos registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString('es-MX', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={movementTone(m.type)}>{m.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{m.variant?.product?.name}</p>
                      <p className="font-mono text-xs text-slate-500">{m.variant?.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.warehouse?.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {m.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600 whitespace-nowrap">
                      {m.previousStock} → <strong className="text-slate-900">{m.newStock}</strong>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>{m.reason || '—'}</p>
                      {m.referenceDoc && (
                        <p className="font-mono text-[11px] text-slate-400">{m.referenceDoc}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{m.user?.fullName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
