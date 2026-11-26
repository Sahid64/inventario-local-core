import { Lock, LogOut, ShieldAlert } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractApiError, getAssetUrl } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Button, Card, inputClassName } from './ui';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

export const IdleLockModal: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { settings, idleLockMinutes, isLocked, setLocked } = useSettingsStore();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isAuthenticated || idleLockMinutes <= 0 || isLocked) {
      return;
    }

    lastActivityRef.current = Date.now();

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }

    const timeoutMs = idleLockMinutes * 60 * 1000;
    const checker = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        setLocked(true);
      }
    }, 5000);

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
      window.clearInterval(checker);
    };
  }, [isAuthenticated, idleLockMinutes, isLocked, setLocked]);

  if (!isAuthenticated || !isLocked || !user) {
    return null;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setError(null);
    try {
      await api.post('/auth/login', {
        username: user.username,
        password,
      });
      setPassword('');
      lastActivityRef.current = Date.now();
      setLocked(false);
    } catch (err) {
      setError(extractApiError(err, 'Contraseña incorrecta.'));
    } finally {
      setUnlocking(false);
    }
  };

  const handleSignOut = () => {
    setPassword('');
    setError(null);
    setLocked(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md no-print">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <img
              src={getAssetUrl(settings.logoPath)}
              alt={settings.companyName}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Sesión bloqueada por inactividad</span>
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-900">{user.fullName}</h2>
          <p className="text-xs text-slate-500">
            @{user.username} · {user.role}
          </p>
        </div>

        <form onSubmit={handleUnlock} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Ingresa tu contraseña para continuar
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputClassName} pl-9`}
              />
            </div>
          </div>

          <Button type="submit" disabled={unlocking} className="w-full py-2.5">
            {unlocking ? 'Verificando...' : 'Desbloquear sesión'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cambiar de usuario / Cerrar sesión
          </button>
        </div>
      </Card>
    </div>
  );
};
