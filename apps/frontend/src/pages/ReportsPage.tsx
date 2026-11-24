import { Download, Printer, Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '../components/ThemeProvider';
import { Badge, Button, Card, inputClassName } from '../components/ui';
import { api, extractApiError } from '../services/api';
import { useSettingsStore } from '../store/useSettingsStore';

interface StockReportRow {
  stockLevelId: string;
  warehouseId: string;
  warehouseName: string;
  variantId: string;
  sku: string;
  barcode: string | null;
  productName: string;
  categoryName: string;
  unit: string;
  quantity: number;
  minStock: number;
  costPrice: number;
  salePrice: number;
  costValuation: number;
  saleValuation: number;
  isLowStock: boolean;
}

export const ReportsPage: React.FC = () => {
  const [rows, setRows] = useState<StockReportRow[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeWarehouseId = useSettingsStore((s) => s.activeWarehouseId);
  const settings = useSettingsStore((s) => s.settings);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<StockReportRow[]>('/reports/stock', {
        params: {
          ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
          ...(search ? { search } : {}),
          ...(lowStockOnly ? { lowStockOnly: 'true' } : {}),
        },
      });
      setRows(data);
    } catch (err) {
      setError(extractApiError(err, 'Error al cargar el reporte de existencias.'));
    } finally {
      setLoading(false);
    }
  }, [activeWarehouseId, search, lowStockOnly]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          units: acc.units + r.quantity,
          cost: acc.cost + r.costValuation,
          sale: acc.sale + r.saleValuation,
        }),
        { units: 0, cost: 0, sale: 0 }
      ),
    [rows]
  );

  const downloadCsv = async (endpoint: string, filename: string) => {
    try {
      const response = await api.get<Blob>(endpoint, {
        params: {
          ...(activeWarehouseId ? { warehouseId: activeWarehouseId } : {}),
          ...(search ? { search } : {}),
          ...(lowStockOnly ? { lowStockOnly: 'true' } : {}),
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractApiError(err, 'No se pudo descargar el archivo CSV.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reportes y Exportación</h1>
          <p className="text-sm text-slate-500">
            Existencias valorizadas, alertas y exportación directa en CSV (Excel) o impresión PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void downloadCsv(
                '/reports/stock/export',
                `existencias_${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
          >
            <Download className="h-4 w-4" />
            Existencias CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void downloadCsv(
                '/reports/movements/export',
                `kardex_${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
          >
            <Download className="h-4 w-4" />
            Kardex CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 no-print">
          {error}
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por producto, SKU o código de barras..."
              className={`${inputClassName} pl-9`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            Solo artículos en stock bajo
          </label>
        </div>
      </Card>

      {/* Cabecera imprimible */}
      <div className="hidden print:block mb-4 border-b pb-3">
        <h2 className="text-lg font-bold">{settings.companyName} — Reporte de Existencias</h2>
        <p className="text-xs text-slate-500">
          Generado el {new Date().toLocaleString('es-MX')}
        </p>
      </div>

      {/* Totales rápidos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Unidades en reporte</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{totals.units.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Valorización a Costo</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatMoney(totals.cost, settings.currencySymbol)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Valorización a Venta</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">
            {formatMoney(totals.sale, settings.currencySymbol)}
          </p>
        </Card>
      </div>

      {/* Tabla de reporte */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Almacén</th>
                <th className="px-4 py-3">SKU / Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Existencia</th>
                <th className="px-4 py-3 text-right">Val. Costo</th>
                <th className="px-4 py-3 text-right">Val. Venta</th>
                <th className="px-4 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    Generando reporte...
                  </td>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No hay registros de existencias para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.stockLevelId} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 text-slate-600">{r.warehouseName}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.productName}</p>
                      <p className="font-mono text-xs text-slate-500">{r.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.categoryName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {r.quantity} {r.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMoney(r.costValuation, settings.currencySymbol)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatMoney(r.saleValuation, settings.currencySymbol)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone={r.isLowStock ? 'warning' : 'success'}>
                        {r.isLowStock ? 'STOCK BAJO' : 'OK'}
                      </Badge>
                    </td>
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
