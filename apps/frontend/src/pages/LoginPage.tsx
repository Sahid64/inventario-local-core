import { Lock, ShieldCheck, User as UserIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, inputClassName } from '../components/ui';
import { extractApiError, getAssetUrl } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const settings = useSettingsStore((s) => s.settings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractApiError(err, 'No se pudo iniciar sesión.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Cabecera White-Label */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <img
              src={getAssetUrl(settings.logoPath)}
              alt={settings.companyName}
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {settings.companyName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistema de Inventario Local · Acceso seguro
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Usuario
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. admin"
                  className={`${inputClassName} pl-9`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClassName} pl-9`}
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full py-2.5">
              {loading ? 'Verificando...' : 'Iniciar sesión'}
            </Button>
          </form>

          {/* Credenciales de demostración */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Credenciales de prueba (Demo)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('123456');
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Autocompletar
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Usuario: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-800">admin</code>{' '}
              · Contraseña:{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-800">123456</code>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
