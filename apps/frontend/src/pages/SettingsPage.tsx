import type { AppSettings } from '@inventario-local/shared/types';
import {
  CheckCircle2,
  DatabaseBackup,
  Lock,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, inputClassName } from '../components/ui';
import { api, extractApiError, getAssetUrl } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

const PRESET_COLORS = ['#0F172A', '#2563EB', '#059669', '#7C3AED', '#DC2626', '#EA580C'];

export const SettingsPage: React.FC = () => {
  const {
    settings,
    setSettings,
    fetchSettings,
    fetchWarehouses,
    idleLockMinutes,
    setIdleLockMinutes,
    setLocked,
  } = useSettingsStore();
  const isAdmin = useAuthStore((s) => s.hasRole('ADMIN'));
  const canBackup = useAuthStore((s) => s.hasRole('ADMIN', 'MANAGER'));

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [taxId, setTaxId] = useState(settings.taxId ?? '');
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [taxRatePercent, setTaxRatePercent] = useState(String(Math.round(settings.taxRate * 100)));
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);

  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setTaxId(settings.taxId ?? '');
    setCurrencySymbol(settings.currencySymbol);
    setTaxRatePercent(String(Number((settings.taxRate * 100).toFixed(2))));
    setPrimaryColor(settings.primaryColor);
  }, [settings]);

  const loadBackups = useCallback(async () => {
    if (!canBackup) return;
    try {
      const { data } = await api.get<BackupInfo[]>('/settings/backups');
      setBackups(data);
    } catch {
      // Silencioso si el rol no tiene acceso
    }
  }, [canBackup]);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.patch<AppSettings>('/settings', {
        companyName,
        taxId: taxId || null,
        currencySymbol,
        taxRate: Number(taxRatePercent) / 100,
        primaryColor,
      });
      setSettings(data);
      setSuccessMsg('Configuración White-Label guardada y aplicada en vivo.');
    } catch (err) {
      setError(extractApiError(err, 'No se pudo guardar la configuración.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result);
        const { data } = await api.post<AppSettings>('/settings/logo', { dataUrl });
        setSettings(data);
        setSuccessMsg('Logo actualizado correctamente.');
      } catch (err) {
        setError(extractApiError(err, 'Error al subir el logo.'));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.post<BackupInfo>('/settings/backups', { label: 'manual' });
      setSuccessMsg(`Respaldo SQLite creado: ${data.filename}`);
      await loadBackups();
    } catch (err) {
      setError(extractApiError(err, 'No se pudo crear el respaldo.'));
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (
      !window.confirm(
        `¿Restaurar la base de datos desde "${filename}"? Se creará un respaldo preventivo automático antes de sobrescribir.`
      )
    ) {
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      await api.post('/settings/backups/restore', { filename });
      setSuccessMsg(`Base de datos restaurada desde ${filename}.`);
      await Promise.all([fetchSettings(), fetchWarehouses(), loadBackups()]);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  const handleResetDemo = async () => {
    if (
      !window.confirm(
        '¿Restaurar los datos de demostración? Esto borrará todos los movimientos, productos y cambios actuales.'
      )
    ) {
      return;
    }
    setResetting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.post('/settings/reset-demo');
      setSuccessMsg('Base de datos reiniciada con los datos de demostración.');
      await Promise.all([fetchSettings(), fetchWarehouses()]);
    } catch (err) {
      setError(extractApiError(err, 'No se pudo restaurar los datos demo.'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Configuración White-Label y Respaldos</h1>
        <p className="text-sm text-slate-500">
          Personaliza la identidad visual del sistema en vivo y administra copias de seguridad de
          SQLite.
        </p>
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

      {/* Panel White-Label */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Identidad de Marca</h2>
            <p className="text-xs text-slate-500">
              Los cambios se reflejan inmediatamente en toda la interfaz.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Nombre de la empresa *
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                RFC / NIT / RUT
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="Opcional"
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Símbolo de moneda
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                maxLength={5}
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Impuesto / IVA (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                disabled={!isAdmin}
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
                className={inputClassName}
              />
            </div>
          </div>

          {/* Color Primario + Logo */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 border-t border-slate-100 pt-5">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Color primario de la marca
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  disabled={!isAdmin}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className={`${inputClassName} w-28 font-mono`}
                />
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setPrimaryColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`h-6 w-6 rounded-full border-2 ${
                        primaryColor.toUpperCase() === hex ? 'border-slate-900 scale-110' : 'border-white'
                      } shadow`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600">
                Logotipo local (PNG, JPG, SVG, WEBP)
              </label>
              <div className="flex items-center gap-4">
                <img
                  src={getAssetUrl(settings.logoPath)}
                  alt="Logo actual"
                  className="h-12 w-12 rounded-xl border border-slate-200 bg-slate-50 object-contain p-1"
                />
                {isAdmin && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Subir nuevo logo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* Seguridad Local: Bloqueo automático por inactividad */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Seguridad Local y Bloqueo por Inactividad
              </h2>
              <p className="text-xs text-slate-500">
                Protege el equipo en mostrador o bodega exigiendo contraseña tras un periodo sin
                actividad.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setLocked(true)}>
            <Lock className="h-4 w-4" />
            Bloquear pantalla ahora
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-end">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Minutos sin actividad antes de bloquear (0 = desactivado)
            </label>
            <input
              type="number"
              min="0"
              max="240"
              value={idleLockMinutes}
              onChange={(e) => setIdleLockMinutes(Number(e.target.value))}
              className={inputClassName}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 5, 10, 15, 30, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setIdleLockMinutes(mins)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  idleLockMinutes === mins
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {mins === 0 ? 'Desactivado' : `${mins} min`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Respaldos SQLite y Modo Demo */}
      {canBackup && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DatabaseBackup className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Respaldos de Base de Datos (SQLite)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Copia consistente con checkpoint WAL hacia la carpeta local /backups.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => void handleCreateBackup()} disabled={backingUp}>
                <DatabaseBackup className="h-4 w-4" />
                {backingUp ? 'Respaldando...' : 'Crear respaldo ahora'}
              </Button>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {!backups.length ? (
                <p className="p-4 text-sm text-slate-500">
                  Aún no hay copias de seguridad guardadas.
                </p>
              ) : (
                backups.map((b) => (
                  <div
                    key={b.filename}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-800">{b.filename}</p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(b.createdAt).toLocaleString('es-MX')} ·{' '}
                        {(b.sizeBytes / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleRestoreBackup(b.filename)}
                      >
                        Restaurar
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {isAdmin && (
            <Card className="p-6 flex flex-col justify-between border-amber-200 bg-amber-50/40">
              <div>
                <Badge tone="warning">Zona de Demostración</Badge>
                <h2 className="mt-3 text-base font-semibold text-slate-900">
                  Restaurar Datos Demo
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Reinicia toda la base de datos SQLite al estado inicial de fábrica (empresa demo,
                  usuario <code className="font-mono">admin / 123456</code>, Almacén Central y
                  producto de muestra). Ideal entre presentaciones comerciales.
                </p>
              </div>
              <Button
                variant="danger"
                className="mt-5 w-full"
                disabled={resetting}
                onClick={() => void handleResetDemo()}
              >
                <RotateCcw className="h-4 w-4" />
                {resetting ? 'Restaurando...' : 'Restaurar Datos Demo'}
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
