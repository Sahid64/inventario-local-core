import React, { useEffect, useRef } from 'react';

interface BarcodeScannerOptions {
  enabled?: boolean;
  minLength?: number;
  maxKeyIntervalMs?: number;
}

/**
 * Hook global que detecta lecturas rápidas provenientes de pistolas escáner USB (modo teclado HID).
 * Distingue el tipeo humano normal de ráfagas rápidas terminadas en Enter.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  options: BarcodeScannerOptions = {}
): void {
  const { enabled = true, minLength = 4, maxKeyIntervalMs = 65 } = options;
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (event.key === 'Enter') {
        const code = bufferRef.current.trim();
        const elapsed = now - lastKeyTimeRef.current;
        bufferRef.current = '';

        if (code.length >= minLength && elapsed <= maxKeyIntervalMs * 2) {
          if (isTextInput) {
            event.preventDefault();
          }
          onScanRef.current(code);
        }
        return;
      }

      // Ignorar teclas de control / modificadores
      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      if (now - lastKeyTimeRef.current > maxKeyIntervalMs) {
        bufferRef.current = '';
      }

      bufferRef.current += event.key;
      lastKeyTimeRef.current = now;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, minLength, maxKeyIntervalMs]);
}

interface BarcodeScannerProps extends BarcodeScannerOptions {
  onScan: (code: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  enabled = true,
  minLength = 4,
  maxKeyIntervalMs = 65,
}) => {
  useBarcodeScanner(onScan, { enabled, minLength, maxKeyIntervalMs });
  return null;
};
