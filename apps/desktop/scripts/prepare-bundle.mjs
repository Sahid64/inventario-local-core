import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '../..');
const bundleRoot = path.join(desktopRoot, 'resources-bundle');
const bundleFrontend = path.join(bundleRoot, 'frontend');
const bundleBackend = path.join(bundleRoot, 'backend');

const IGNORED_DIRS = new Set(['test', 'tests', '__tests__', 'docs', 'doc', 'example', 'examples', '.github']);
const IGNORED_EXTS = new Set(['.map', '.ts', '.mts', '.cts', '.md', '.markdown']);

function shouldCopy(srcPath) {
  const name = path.basename(srcPath);
  const stat = fs.lstatSync(srcPath);

  if (stat.isDirectory()) {
    // No copiar carpetas de código fuente TypeScript ni pruebas dentro de paquetes
    if (IGNORED_DIRS.has(name.toLowerCase())) return false;
    if (name === 'src' && srcPath.includes('@inventario-local')) return false;
    return true;
  }

  const lower = name.toLowerCase();
  if (lower.endsWith('.d.ts') || lower.endsWith('.d.mts') || lower.endsWith('.d.cts')) return false;
  const ext = path.extname(lower);
  if (IGNORED_EXTS.has(ext)) return false;

  return true;
}

function copyFiltered(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (s) => shouldCopy(s),
  });
}

console.log('[Desktop Bundle] Preparando recursos limpios para app.asar...');
fs.rmSync(bundleRoot, { recursive: true, force: true });
fs.mkdirSync(bundleFrontend, { recursive: true });
fs.mkdirSync(bundleBackend, { recursive: true });

// 1. Frontend compilado (sin sourcemaps)
const frontendDist = path.join(repoRoot, 'apps', 'frontend', 'dist');
if (!fs.existsSync(frontendDist)) {
  throw new Error(`Falta ${frontendDist}. Ejecuta "npm run build" antes de empaquetar.`);
}
copyFiltered(frontendDist, bundleFrontend);

// 2. Backend compilado (solo JS compilado, sin .map ni schema.prisma visible)
const backendRoot = path.join(repoRoot, 'apps', 'backend');
const backendDist = path.join(backendRoot, 'dist');
if (!fs.existsSync(backendDist)) {
  throw new Error(`Falta ${backendDist}. Ejecuta "npm run build" antes de empaquetar.`);
}
copyFiltered(backendDist, path.join(bundleBackend, 'dist'));

// Base de datos plantilla inicial (empaquetada dentro del asar)
const templateDb = path.join(backendRoot, 'prisma', 'inventario_local.db');
if (!fs.existsSync(templateDb) || fs.statSync(templateDb).size === 0) {
  throw new Error(
    `Falta la base de datos semilla válida en ${templateDb}. Ejecuta "npm run db:setup" primero.`
  );
}
fs.copyFileSync(templateDb, path.join(bundleBackend, 'seed.db'));

// 3. Dependencias estrictas de producción del backend (sin fuentes ni docs)
const rootNodeModules = path.join(repoRoot, 'node_modules');
const destNodeModules = path.join(bundleBackend, 'node_modules');
fs.mkdirSync(destNodeModules, { recursive: true });

const backendPkg = JSON.parse(
  fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8')
);

const visited = new Set();
const queue = Object.keys(backendPkg.dependencies ?? {});

while (queue.length > 0) {
  const pkgName = queue.shift();
  if (!pkgName || visited.has(pkgName)) continue;
  visited.add(pkgName);

  const srcPkgDir = path.join(rootNodeModules, pkgName);
  if (!fs.existsSync(srcPkgDir)) continue;

  const realSrcDir = fs.realpathSync(srcPkgDir);
  const destPkgDir = path.join(destNodeModules, pkgName);
  copyFiltered(realSrcDir, destPkgDir);

  const pkgJsonPath = path.join(realSrcDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    for (const dep of Object.keys(parsed.dependencies ?? {})) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }
}

// Copiar cliente Prisma generado (.prisma)
const dotPrismaSrc = path.join(rootNodeModules, '.prisma');
if (fs.existsSync(dotPrismaSrc)) {
  copyFiltered(dotPrismaSrc, path.join(destNodeModules, '.prisma'));
}

console.log(
  `[Desktop Bundle] Recursos empaquetables listos en ${bundleRoot} (${visited.size} dependencias mínimas, sin archivos de repositorio ni sourcemaps).`
);
