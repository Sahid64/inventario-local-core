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

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

console.log('[Desktop Bundle] Preparando recursos offline...');
fs.rmSync(bundleRoot, { recursive: true, force: true });
fs.mkdirSync(bundleFrontend, { recursive: true });
fs.mkdirSync(bundleBackend, { recursive: true });

// 1. Frontend compilado
const frontendDist = path.join(repoRoot, 'apps', 'frontend', 'dist');
if (!fs.existsSync(frontendDist)) {
  throw new Error(`Falta ${frontendDist}. Ejecuta "npm run build" antes de empaquetar.`);
}
copyDir(frontendDist, bundleFrontend);

// 2. Backend compilado + Prisma + DB plantilla
const backendRoot = path.join(repoRoot, 'apps', 'backend');
const backendDist = path.join(backendRoot, 'dist');
if (!fs.existsSync(backendDist)) {
  throw new Error(`Falta ${backendDist}. Ejecuta "npm run build" antes de empaquetar.`);
}
copyDir(backendDist, path.join(bundleBackend, 'dist'));
fs.copyFileSync(path.join(backendRoot, 'package.json'), path.join(bundleBackend, 'package.json'));

const prismaDest = path.join(bundleBackend, 'prisma');
fs.mkdirSync(prismaDest, { recursive: true });
fs.copyFileSync(
  path.join(backendRoot, 'prisma', 'schema.prisma'),
  path.join(prismaDest, 'schema.prisma')
);

const templateDb = path.join(backendRoot, 'prisma', 'inventario_local.db');
if (fs.existsSync(templateDb)) {
  fs.copyFileSync(templateDb, path.join(prismaDest, 'inventario_local.db'));
}

// 3. Dependencias de ejecución del backend (hoisted node_modules + @inventario-local/shared)
const rootNodeModules = path.join(repoRoot, 'node_modules');
const destNodeModules = path.join(bundleBackend, 'node_modules');
fs.mkdirSync(destNodeModules, { recursive: true });

const backendPkg = JSON.parse(
  fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8')
);

// Recolectar dependencias recursivas de producción del backend
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
  copyDir(realSrcDir, destPkgDir);

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
  copyDir(dotPrismaSrc, path.join(destNodeModules, '.prisma'));
}

console.log(
  `[Desktop Bundle] Recursos listos en ${bundleRoot} (${visited.size} paquetes de backend incluidos).`
);
