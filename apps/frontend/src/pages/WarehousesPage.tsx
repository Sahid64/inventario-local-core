import type { Product, Warehouse } from '@inventario-local/shared/types';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Edit2,
  MapPin,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, inputClassName, Modal } from '../components/ui';
import { api, extractApiError } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

interface WarehouseWithCount extends Warehouse {
  _count?: { stocks: number; movements: number };
}

interface FlatVariant {
  id: string;
  sku: string;
  productName: string;
}

export const WarehousesPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<WarehouseWithCount[]>([]);
  const [variants, setVariants] = useState<FlatVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Almacén
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseWithCount | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Asistente de traspaso
  const [transferVariantId, setTransferVariantId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [transferRef, setTransferRef] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferring, setTransferring] = useState(false);

  const canManage = useAuthStore((s) => s.hasRole('ADMIN', 'MANAGER'));
  const isAdmin = useAuthStore((s) => s.hasRole('ADMIN'));
  const fetchGlobalWarehouses = useSettingsStore((s) => s.fetchWarehouses);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [whRes, prodRes] = await Promise.all([
        api.get<WarehouseWithCount[]>('/inventory/warehouses'),
        api.get<Product[]>('/catalog/products'),
      ]);
      setWarehouses(whRes.data);

      const flat: FlatVariant[] = [];
      for (const p of prodRes.data) {
        for (const v of p.variants ?? []) {
          flat.push({ id: v.id, sku: v.sku, productName: p.name });
        }
      }
      setVariants(flat);

      if (flat.length > 0 && !transferVariantId) setTransferVariantId(flat[0].id);
      if (whRes.data.length >= 1 && !fromWarehouseId) setFromWarehouseId(whRes.data[0].id);
      if (whRes.data.length >= 2 && !toWarehouseId) setToWarehouseId(whRes.data[1].id);
    } catch (err) {
      setError(extractApiError(err, 'Error al cargar almacenes.'));
    } finally {
      setLoading(false);
    }
  }, [transferVariantId, fromWarehouseId, toWarehouseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setLocation('');
    setIsDefault(false);
    setModalOpen(true);
  };

  const openEdit = (wh: WarehouseWithCount) => {
    setEditing(wh);
    setName(wh.name);
    setLocation(wh.location ?? '');
    setIsDefault(wh.isDefault);
    setModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await api.patch(`/inventory/warehouses/${editing.id}`, {
          name,
          location: location || undefined,
          isDefault,
        });
      } else {
        await api.post('/inventory/warehouses', {
          name,
          location: location || undefined,
          isDefault,
        });
      }
      setModalOpen(false);
      await Promise.all([loadData(), fetchGlobalWarehouses()]);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const handleDelete = async (wh: WarehouseWithCount) => {
    if (!window.confirm(`¿Eliminar el almacén "${wh.name}"?`)) return;
    setError(null);
    try {
      await api.delete(`/inventory/warehouses/${wh.id}`);
      await Promise.all([loadData(), fetchGlobalWarehouses()]);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferring(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.post<{ sourceNewStock: number; destNewStock: number }>(
        '/inventory/transfers',
        {
          variantId: transferVariantId,
          fromWarehouseId,
          toWarehouseId,
          quantity: Number(transferQty),
          referenceDoc: transferRef || undefined,
          notes: transferNotes || undefined,
        }
      );
      setSuccessMsg(
        `Traspaso completado. Stock origen: ${data.sourceNewStock} · Stock destino: ${data.destNewStock}`
      );
      setTransferQty('1');
      setTransferRef('');
      setTransferNotes('');
      await loadData();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo completar el traspaso.'));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Almacenes y Traspasos</h1>
          <p className="text-sm text-slate-500">
            Administra sucursales/ubicaciones físicas y ejecuta traspasos atómicos entre almacenes.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo almacén
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Lista de almacenes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="p-6 text-sm text-slate-500">Cargando almacenes...</Card>
        ) : (
          warehouses.map((wh) => (
            <Card key={wh.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{wh.name}</h3>
                      {wh.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {wh.location}
                        </p>
                      )}
                    </div>
                  </div>
                  {wh.isDefault && (
                    <Badge tone="info">
                      <Star className="mr-1 h-3 w-3" />
                      Principal
                    </Badge>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="text-slate-500">SKUs con stock</p>
                    <p className="font-semibold text-slate-900">{wh._count?.stocks ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Movimientos</p>
                    <p className="font-semibold text-slate-900">{wh._count?.movements ?? 0}</p>
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="mt-4 flex justify-end gap-1 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => openEdit(wh)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {isAdmin && !wh.isDefault && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(wh)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Asistente de Traspasos */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Traspaso entre Almacenes
            </h2>
            <p className="text-xs text-slate-500">
              Descuenta del almacén origen y abona al destino en una sola transacción SQLite.
            </p>
          </div>
        </div>

        {warehouses.length < 2 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Necesitas al menos 2 almacenes creados para realizar traspasos de mercancía.
          </p>
        ) : (
          <form onSubmit={handleTransfer} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Producto / SKU *
              </label>
              <select
                required
                value={transferVariantId}
                onChange={(e) => setTransferVariantId(e.target.value)}
                className={inputClassName}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} — {v.productName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Origen *</label>
              <select
                required
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
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
              <label className="mb-1 block text-xs font-semibold text-slate-600">Destino *</label>
              <select
                required
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
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
              <label className="mb-1 block text-xs font-semibold text-slate-600">Cantidad *</label>
              <input
                type="number"
                required
                step="0.01"
                min="0.01"
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Referencia</label>
              <input
                type="text"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                placeholder="TRASP-001"
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Notas</label>
              <input
                type="text"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Opcional"
                className={inputClassName}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" disabled={transferring} className="w-full">
                {transferring ? 'Transfiriendo...' : 'Ejecutar traspaso'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Modal Almacén */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Almacén' : 'Nuevo Almacén'}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveWarehouse} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Nombre *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sucursal Norte"
              className={inputClassName}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Ubicación</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej. Bodega 2, Pasillo B"
              className={inputClassName}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-300"
            />
            Marcar como almacén principal por defecto
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
