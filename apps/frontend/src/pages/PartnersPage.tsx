import type { Partner, PartnerType } from '@inventario-local/shared/types';
import { Edit2, Mail, MapPin, Phone, Plus, Search, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, inputClassName, Modal } from '../components/ui';
import { api, extractApiError } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

const PARTNER_LABELS: Record<PartnerType, string> = {
  SUPPLIER: 'Proveedor',
  CUSTOMER: 'Cliente',
  BOTH: 'Ambos',
};

export const PartnersPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [type, setType] = useState<PartnerType>('SUPPLIER');
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const canManage = useAuthStore((s) => s.hasRole('ADMIN', 'MANAGER'));

  const loadPartners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<Partner[]>('/partners', {
        params: {
          ...(typeFilter ? { type: typeFilter } : {}),
          ...(search ? { search } : {}),
        },
      });
      setPartners(data);
    } catch (err) {
      setError(extractApiError(err, 'Error al cargar terceros.'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);

  const openCreate = () => {
    setEditing(null);
    setType('SUPPLIER');
    setName('');
    setTaxId('');
    setPhone('');
    setEmail('');
    setAddress('');
    setModalOpen(true);
  };

  const openEdit = (partner: Partner) => {
    setEditing(partner);
    setType(partner.type);
    setName(partner.name);
    setTaxId(partner.taxId ?? '');
    setPhone(partner.phone ?? '');
    setEmail(partner.email ?? '');
    setAddress(partner.address ?? '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        type,
        name,
        taxId: taxId || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
      };
      if (editing) {
        await api.patch(`/partners/${editing.id}`, payload);
      } else {
        await api.post('/partners', payload);
      }
      setModalOpen(false);
      await loadPartners();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (partner: Partner) => {
    if (!window.confirm(`¿Eliminar a "${partner.name}" del directorio?`)) return;
    try {
      await api.delete(`/partners/${partner.id}`);
      await loadPartners();
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proveedores y Clientes</h1>
          <p className="text-sm text-slate-500">
            Directorio local de contactos comerciales, RFC/NIT y datos de contacto.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo tercero
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, RFC/NIT, teléfono o correo..."
              className={`${inputClassName} pl-9`}
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={inputClassName}
          >
            <option value="">Todos los tipos</option>
            <option value="SUPPLIER">Proveedores</option>
            <option value="CUSTOMER">Clientes</option>
            <option value="BOTH">Ambos</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Nombre / Razón Social</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">ID Fiscal</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    Cargando directorio...
                  </td>
                </tr>
              ) : !partners.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    Aún no hay proveedores ni clientes registrados.
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      {p.address && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {p.address}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          p.type === 'SUPPLIER'
                            ? 'info'
                            : p.type === 'CUSTOMER'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {PARTNER_LABELS[p.type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.taxId || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 space-y-0.5">
                      {p.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {p.phone}
                        </p>
                      )}
                      {p.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {p.email}
                        </p>
                      )}
                      {!p.phone && !p.email && '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(p)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Tercero' : 'Nuevo Tercero'}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PartnerType)}
                className={inputClassName}
              >
                <option value="SUPPLIER">Proveedor</option>
                <option value="CUSTOMER">Cliente</option>
                <option value="BOTH">Proveedor y Cliente</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                RFC / NIT / RUT
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Nombre / Razón Social *
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
              <label className="mb-1 block text-xs font-semibold text-slate-600">Teléfono</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Dirección</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClassName}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
