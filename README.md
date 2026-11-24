# Inventario Local Core (White-Label)

Sistema de inventario 100% local (offline-first / red LAN) construido como monorepo con **Node.js + Express + Prisma + SQLite (modo WAL)** en el backend, **React + TypeScript + Tailwind CSS + Zustand** en el frontend y empaquetado de escritorio con **Tauri**.

## Estructura del Monorepo

- `apps/backend` — API REST `/api/v1`, motor transaccional Kardex, SQLite en modo WAL, respaldos `.db`, exportación CSV.
- `apps/frontend` — Aplicación web responsiva con personalización White-Label en vivo y soporte para pistolas escáner USB.
- `apps/desktop` — Contenedor nativo Tauri (`.exe` / `.dmg`).
- `packages/shared` — Tipos TypeScript y validaciones Zod compartidas.

## Instalación y Primera Ejecución

Requisitos: **Node.js 20+** y **npm 10+**.

```bash
# 1. Instalar todas las dependencias del monorepo
npm install

# 2. Compilar shared, generar Prisma Client, migrar SQLite y cargar datos demo
npm run db:setup

# 3. Levantar Backend (puerto 3001) y Frontend (puerto 5173) en un solo comando
npm run dev
```

Abre en tu navegador: **http://localhost:5173**

### Credenciales Demo por defecto
- **Usuario:** `admin`
- **Contraseña:** `123456`

## Scripts Principales

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Levanta backend y frontend simultáneamente en modo desarrollo |
| `npm run db:setup` | Compila `shared`, genera Prisma Client, aplica migraciones SQLite y ejecuta `seed.ts` |
| `npm run db:generate` | Regenera Prisma Client |
| `npm run db:migrate` | Ejecuta migraciones pendientes de Prisma |
| `npm run db:seed` | Carga los datos iniciales de demostración |
| `npm run build` | Compila `packages/shared`, `apps/backend` y `apps/frontend` para producción |
| `npm run typecheck` | Verifica tipos TypeScript en todo el monorepo |

## Acceso desde Red Local (LAN)

El backend escucha por defecto en `0.0.0.0:3001`. Para acceder desde otra computadora o tablet en la misma red local, abre `http://<IP-LOCAL>:5173` (en desarrollo) o configura `VITE_API_URL=http://<IP-LOCAL>:3001/api/v1` al compilar el frontend.
