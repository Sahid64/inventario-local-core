import type { AppSettings, Warehouse } from '@inventario-local/shared/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  companyName: 'Inventario Local',
  taxId: null,
  currencySymbol: '$',
  taxRate: 0.16,
  primaryColor: '#0F172A',
  logoPath: null,
  updatedAt: new Date().toISOString(),
};

interface SettingsState {
  settings: AppSettings;
  warehouses: Warehouse[];
  activeWarehouseId: string; // '' representa "Todos los almacenes"
  loadingSettings: boolean;
  fetchSettings: () => Promise<void>;
  setSettings: (settings: AppSettings) => void;
  fetchWarehouses: () => Promise<void>;
  setActiveWarehouseId: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      warehouses: [],
      activeWarehouseId: '',
      loadingSettings: false,

      fetchSettings: async () => {
        set({ loadingSettings: true });
        try {
          const { data } = await api.get<AppSettings>('/settings');
          set({ settings: data });
        } catch {
          // Mantener valores actuales/por defecto si el servidor aún está iniciando
        } finally {
          set({ loadingSettings: false });
        }
      },

      setSettings: (settings: AppSettings) => set({ settings }),

      fetchWarehouses: async () => {
        try {
          const { data } = await api.get<Warehouse[]>('/inventory/warehouses');
          const current = get().activeWarehouseId;
          const stillExists = data.some((w) => w.id === current);
          set({
            warehouses: data,
            activeWarehouseId: stillExists ? current : '',
          });
        } catch {
          // Silencioso si no hay sesión aún
        }
      },

      setActiveWarehouseId: (id: string) => set({ activeWarehouseId: id }),
    }),
    {
      name: 'inventario-local-settings',
      partialize: (state) => ({
        settings: state.settings,
        activeWarehouseId: state.activeWarehouseId,
      }),
    }
  )
);
