# Inventario Local Core (White-Label · 100% Offline)

Sistema de inventario **100% local y offline** (aplicación de escritorio + modo web local) construido como monorepo con **Node.js + Express + Prisma + SQLite (WAL / `synchronous=FULL`)**, **React + TypeScript + Tailwind CSS + Zustand** y empaquetado nativo con **Electron (`app.asar`)**.

---

## Estructura del Monorepo

- `apps/backend` — API REST `/api/v1` vinculada a `127.0.0.1`, motor transaccional Kardex, SQLite anti-apagones (`WAL` + `synchronous=FULL` + `foreign_keys=ON`), autenticación JWT + RBAC, protección `x-app-secret`, respaldos rotativos `VACUUM INTO` y exportación CSV.
- `apps/frontend` — Interfaz React responsiva 100% offline (sin CDNs ni fuentes externas), personalización White-Label en vivo, soporte para pistolas escáner USB, autoguardado de borradores ante cierres inesperados y bloqueo automático por inactividad.
- `apps/desktop` — Empaquetado de escritorio con **Electron + electron-builder** (`.exe` NSIS / `.dmg` / `.AppImage`). Encapsula frontend y backend dentro de `app.asar` sin exponer archivos del repositorio, levanta el backend en un puerto libre de `127.0.0.1` usando el runtime Node embebido (`ELECTRON_RUN_AS_NODE=1`) y cierra limpiamente el proceso al salir.
- `packages/shared` — Tipos TypeScript y esquemas de validación Zod compartidos entre backend y frontend.

---

## Características Principales

### Persistencia y Seguridad Local
- **Protección anti-apagones en SQLite:** Al arrancar se ejecutan `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = FULL;`, `PRAGMA foreign_keys = ON;` y `PRAGMA busy_timeout = 5000;`, con `wal_checkpoint(TRUNCATE)` al cerrar.
- **Respaldos automáticos rotativos (`VACUUM INTO`):** Se genera un respaldo consistente al iniciar el servidor y cada **30 minutos**, conservando automáticamente los últimos **10** respaldos en `<APP_DATA_DIR>/backups/`. También permite respaldo y restauración manual desde **Configuración**.
- **Aislamiento en loopback (`127.0.0.1`) y `x-app-secret`:** En modo escritorio, Electron genera un secreto aleatorio en cada arranque y lo inyecta al backend y al `preload.cjs`; toda petición a `/api/v1/*` sin ese encabezado es rechazada (`403`).
- **Empaquetado cerrado (`app.asar`):** El instalador encapsula frontend, backend y dependencias dentro de `resources/app.asar` (desempacando únicamente el motor nativo `.node` de Prisma/SQLite) y deshabilita DevTools en producción.

### Resiliencia y UX en Frontend
- **Autoguardado de borradores (`useAutoSaveDraft`):** Los formularios de **Movimientos / Kardex** y **Catálogo** guardan borradores automáticamente en `localStorage` y ofrecen restaurarlos tras un cierre inesperado o apagón.
- **Bloqueo por inactividad (`IdleLockModal`):** Bloquea la pantalla tras *X* minutos sin actividad (configurable en **Configuración**, por defecto 15 min, o manualmente desde el icono de candado) exigiendo la contraseña del usuario activo.
- **White-Label en vivo:** Cambio inmediato de nombre de empresa, RFC/NIT, color primario, moneda, IVA, logotipo local y botón **Restaurar Datos Demo**.
- **Pistola escáner USB (HID):** Listener global en `MovementsPage` que detecta ráfagas de lectura + `Enter` sin perder el foco.

---

## Instalación y Uso en Desarrollo

Requisitos: **Node.js 20+** y **npm 10+**.

```bash
# 1. Instalar todas las dependencias del monorepo
npm install

# 2. Compilar shared, generar Prisma Client, aplicar migraciones SQLite y cargar datos demo
npm run db:setup

# 3. Levantar Backend (127.0.0.1:3001) y Frontend (localhost:5173) en modo web
npm run dev
```

Abre **http://localhost:5173** en tu navegador.

### Credenciales Demo por defecto
- **Usuario:** `admin`
- **Contraseña:** `123456`

---

## Modo Escritorio y Generación de Instalador Offline

```bash
# Probar la ventana de escritorio Electron localmente (requiere build previo)
npm run build
npm run dev:desktop

# Compilar todo (shared + backend + frontend) y generar el instalador offline
npm run build:desktop
```

El instalador generado queda en `apps/desktop/release/`:
- **Windows:** `Inventario Local Setup 1.0.0.exe` (instalador NSIS) y versión ejecutable directa en `apps/desktop/release/win-unpacked/Inventario Local.exe`.
- **macOS:** `.dmg`
- **Linux:** `.AppImage`

### Ubicación de Datos del Usuario en Producción (`APP_DATA_DIR`)
Al ejecutarse la app de escritorio instalada, todos los datos persistentes se almacenan fuera de la carpeta del programa:
- **Windows:** `%APPDATA%\Inventario Local\`
- **macOS:** `~/Library/Application Support/Inventario Local/`
- **Linux:** `~/.config/Inventario Local/`

Dentro de esa carpeta se guardan:
- `inventario_local.db` — Base de datos SQLite en modo WAL.
- `backups/` — Copias automáticas rotativas (`VACUUM INTO`, últimos 10 archivos).
- `uploads/` — Logotipos personalizados White-Label.
- `logs/backend.log` — Registro local de arranque y diagnóstico del backend.

---

## Scripts del Monorepo

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Levanta backend y frontend simultáneamente en modo desarrollo web |
| `npm run dev:desktop` | Inicia la aplicación de escritorio Electron localmente |
| `npm run build` | Compila `packages/shared`, `apps/backend` y `apps/frontend` |
| `npm run build:desktop` | Compila todo el monorepo y genera el instalador de escritorio offline |
| `npm run typecheck` | Verifica tipos TypeScript en `shared`, `backend` y `frontend` |
| `npm run db:setup` | Compila `shared`, genera Prisma Client, aplica migraciones y ejecuta `seed.ts` |
| `npm run db:generate` | Regenera Prisma Client |
| `npm run db:migrate` | Ejecuta migraciones de Prisma en desarrollo |
| `npm run db:seed` | Carga los datos iniciales de demostración |
