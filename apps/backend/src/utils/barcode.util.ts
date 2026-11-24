import crypto from 'crypto';

/**
 * Calcula el dígito verificador estándar EAN-13 a partir de los primeros 12 dígitos.
 */
export function calculateEan13CheckDigit(digits12: string): number {
  if (!/^\d{12}$/.test(digits12)) {
    throw new Error('Se requieren exactamente 12 dígitos numéricos para calcular EAN-13.');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(digits12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Genera un código EAN-13 interno válido usando el prefijo GS1 reservado para uso interno (200-299).
 */
export function generateInternalEan13(prefix = '200'): string {
  const cleanPrefix = prefix.replace(/\D/g, '').slice(0, 3).padEnd(3, '0');
  const randomPart = crypto
    .randomInt(0, 1_000_000_000)
    .toString()
    .padStart(9, '0');
  const base12 = `${cleanPrefix}${randomPart}`;
  const checkDigit = calculateEan13CheckDigit(base12);
  return `${base12}${checkDigit}`;
}

/**
 * Valida si una cadena corresponde a un código EAN-13 válido (13 dígitos + dígito verificador).
 */
export function validateEan13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }

  const expected = calculateEan13CheckDigit(barcode.slice(0, 12));
  return Number(barcode[12]) === expected;
}

/**
 * Genera un código interno compatible con Code128 (ej. INV-261124-A9F2).
 */
export function generateInternalCode128(prefix = 'INV'): string {
  const cleanPrefix = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'INV';
  const now = new Date();
  const datePart = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${cleanPrefix}-${datePart}-${randPart}`;
}

/**
 * Valida un código compatible con Code128 (caracteres ASCII imprimibles, 4 a 48 caracteres).
 */
export function validateCode128(code: string): boolean {
  return /^[\x21-\x7E]{4,48}$/.test(code);
}

/**
 * Valida si un código es un EAN-13 válido o un Code128 aceptable.
 */
export function isValidBarcode(code: string): boolean {
  const trimmed = code.trim();
  if (/^\d{13}$/.test(trimmed)) {
    return validateEan13(trimmed);
  }
  return validateCode128(trimmed);
}
