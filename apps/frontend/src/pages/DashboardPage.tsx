import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  DollarSign,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../components/ThemeProvider';
import { Badge, Button, Card } from '../components/ui';
import { api, extractApiError } from '../services/api';
import { useSettingsStore } from '../store/useSettingsStore';

interface DashboardData {
  summary: {
    activeProducts: number;
    activeVariants: number;
    totalUnits: number;
    totalCostValue: number;
    totalSaleValue: number;
    potentialMargin: number;
    lowStockCount: number;
  };
  lowStockAlerts: Array<{
    variantId: string;
    sku: string;
    productName: string;
    unit: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    minStock: number;
    deficit: number;
  }>;
  warehouseSummary: Array<{
    warehouseId: string;
    warehouseName: string;
    location: string | null;
    totalUnits: number;
    costValue: number;
    saleValue: number;
    lowStockCount: number;
  }>;
  topRotating: Array<{
    variantId: string;
    sku: string;
    productName: string;
    unit: string;
    totalOutQuantity: number;
    movementsCount: number;
  }>;
  recentMovements: Array<{
    id: string;
    type: string;
    reason: string | null;
    quantity: number;
    previousStock: number;
    newStock: number;
    createdAt: string;
    variant: { sku: string; product: { name: string; unit: string } };
    warehouse: { name: string };
    user: { fullName: string };
  }>;
}

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeWarehouseId = useSettingsStore((s) => s.activeWarehouseId);
  const currencySymbol = useSettingsStore((s) => s.settings.currencySymbol);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.get<DashboardData>('/reports/dashboard', {
        params: activeWarehouseId ? { warehouseId: activeWarehouseId } : undefined,
      });
      setData(res);
    } catch (err) {
      setError(extractApiError(err, 'No se pudo cargar el dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [activeWarehouseId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const movementTone = (type: string) => {
    if (type === 'IN') return 'success';
    if (type === 'OUT') return 'danger';
    if (type === 'ADJUST') return 'warning';
    return 'info';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Panel de Control</h1>
          <p className="text-sm text-slate-500">
            Valorización en tiempo real, alertas de stock mínimo y actividad reciente del Kardex.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void loadDashboard()}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Link to="/movements">
            <Button size="sm">Registrar movimiento</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Valorización (Costo)
            </span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatMoney(data?.summary.totalCostValue ?? 0, currencySymbol)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Venta estimada: {formatMoney(data?.summary.totalSaleValue ?? 0, currencySymbol)}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Margen Potencial
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatMoney(data?.summary.potentialMargin ?? 0, currencySymbol)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sobre {data?.summary.totalUnits ?? 0} unidades en existencia
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Catálogo Activo
            </span>
            <Boxes className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data?.summary.activeProducts ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data?.summary.activeVariants ?? 0} variantes / SKUs registrados
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Alertas de Stock Bajo
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${
                (data?.summary.lowStockCount ?? 0) > 0 ? 'text-amber-500' : 'text-emerald-500'
              }`}
            />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data?.summary.lowStockCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {(data?.summary.lowStockCount ?? 0) > 0
              ? 'Requieren reposición pronta'
              : 'Todos los niveles saludables'}
          </p>
        </Card>
      </div>

      {/* Alertas de stock bajo + Resumen por almacén */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Alertas de Stock Mínimo</h2>
              <p className="text-xs text-slate-500">
                Artículos con existencia igual o inferior a su mínimo configurado
              </p>
            </div>
            <Link to="/catalog" className="text-xs font-medium text-primary hover:underline">
              Ver catálogo
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">SKU / Producto</th>
                  <th className="px-4 py-3">Almacén</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right">Mínimo</th>
                  <th className="px-4 py-3 text-right">Déficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!data?.lowStockAlerts.length ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                      No hay alertas de stock mínimo en este momento.
                    </td>
                  </tr>
                ) : (
                  data.lowStockAlerts.slice(0, 8).map((alert) => (
                    <tr key={`${alert.variantId}-${alert.warehouseId}`} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{alert.productName}</p>
                        <p className="font-mono text-xs text-slate-500">{alert.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{alert.warehouseName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        {alert.quantity} {alert.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{alert.minStock}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge tone="warning">-{alert.deficit}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Resumen por almacén */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Resumen por Almacén</h2>
            <Building2 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            {!data?.warehouseSummary.length ? (
              <p className="p-5 text-sm text-slate-500">Sin almacenes configurados.</p>
            ) : (
              data.warehouseSummary.map((wh) => (
                <div key={wh.warehouseId} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{wh.warehouseName}</p>
                    {wh.lowStockCount > 0 && (
                      <Badge tone="warning">{wh.lowStockCount} bajas</Badge>
                    )}
                  </div>
                  {wh.location && <p className="text-xs text-slate-500">{wh.location}</p>}
                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
                    <span>{wh.totalUnits} uds.</span>
                    <span className="font-semibold text-slate-900">
                      {formatMoney(wh.costValue, currencySymbol)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Últimos movimientos Kardex */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Últimos Movimientos (Kardex)</h2>
            <p className="text-xs text-slate-500">Historial inmutable de entradas, salidas y ajustes</p>
          </div>
          <Link to="/movements" className="text-xs font-medium text-primary hover:underline">
            Ver Kardex completo
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Producto / SKU</th>
                <th className="px-4 py-3">Almacén</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Stock Final</th>
                <th className="px-4 py-3">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data?.recentMovements.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                    Aún no se han registrado movimientos en el Kardex.
                  </td>
                </tr>
              ) : (
                data.recentMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString('es-MX', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={movementTone(m.type)}>
                        {m.type === 'IN' && <ArrowDownLeft className="mr-1 h-3 w-3" />}
                        {m.type === 'OUT' && <ArrowUpRight className="mr-1 h-3 w-3" />}
                        {m.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{m.variant.product.name}</p>
                      <p className="font-mono text-xs text-slate-500">{m.variant.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.warehouse.name}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {m.quantity} {m.variant.product.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {m.previousStock} → <span className="font-semibold text-slate-900">{m.newStock}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{m.user.fullName}</td>
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
