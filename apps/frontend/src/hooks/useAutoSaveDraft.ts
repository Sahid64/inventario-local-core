import { useCallback, useEffect, useRef, useState } from 'react';

interface StoredDraft<T> {
  data: T;
  savedAt: string;
}

interface UseAutoSaveDraftOptions {
  enabled?: boolean;
  debounceMs?: number;
  isDirty?: boolean;
}

const STORAGE_PREFIX = 'inventario-local-draft:';

/**
 * Hook reutilizable para autoguardar borradores de formularios en localStorage.
 * Protege contra apagones o cierres inesperados y ofrece restaurar el borrador pendiente al volver.
 */
export function useAutoSaveDraft<T>(
  key: string,
  formData: T,
  options: UseAutoSaveDraftOptions = {}
) {
  const { enabled = true, debounceMs = 450, isDirty = true } = options;
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [pendingDraft, setPendingDraft] = useState<StoredDraft<T> | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredDraft<T>;
      return parsed && parsed.data ? parsed : null;
    } catch {
      return null;
    }
  });

  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // Autoguardado con debounce (no sobrescribe un borrador pendiente sin resolver)
  useEffect(() => {
    if (!enabled || !isDirty || pendingDraft) return;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      try {
        const payload: StoredDraft<T> = {
          data: formData,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setLastSavedAt(payload.savedAt);
      } catch {
        // Ignorar errores de cuota de localStorage
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [enabled, isDirty, pendingDraft, formData, debounceMs, storageKey]);

  const restoreDraft = useCallback((): T | null => {
    if (!pendingDraft) return null;
    const restored = pendingDraft.data;
    setPendingDraft(null);
    return restored;
  }, [pendingDraft]);

  const dismissDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignorar
    }
    setPendingDraft(null);
    setLastSavedAt(null);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignorar
    }
    setPendingDraft(null);
    setLastSavedAt(null);
  }, [storageKey]);

  return {
    hasPendingDraft: Boolean(pendingDraft),
    pendingDraftSavedAt: pendingDraft?.savedAt ?? null,
    lastSavedAt,
    restoreDraft,
    dismissDraft,
    clearDraft,
  };
}
