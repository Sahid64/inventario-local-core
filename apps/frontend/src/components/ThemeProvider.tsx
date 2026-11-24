import React, { useEffect } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';

function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '').trim();
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return '15 23 42';
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function formatMoney(amount: number, currencySymbol?: string): string {
  const symbol = currencySymbol ?? useSettingsStore.getState().settings.currencySymbol ?? '$';
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const settings = useSettingsStore((s) => s.settings);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const root = document.documentElement;
    const color = settings.primaryColor || '#0F172A';
    root.style.setProperty('--color-primary', color);
    root.style.setProperty('--color-primary-rgb', hexToRgbChannels(color));
    document.title = settings.companyName
      ? `${settings.companyName} · Inventario Local`
      : 'Inventario Local';
  }, [settings.primaryColor, settings.companyName]);

  return <>{children}</>;
};
