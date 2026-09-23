const { NAO_RFC_VALIDOS, NAO_NOMBRES_VALIDOS } = require('../config/company-rules');
const { normalize } = require('./text-fields');

// Patrones genéricos (no dependen de configuración de NAO) para detectar
// componentes típicos de un domicilio y de una fecha de expedición.
const ADDRESS_HINT_REGEX =
  /\b(\d{1,6}\s+[A-Za-z0-9.,'\s]{3,60}(street|st\.|avenue|ave\.|blvd|road|rd\.|suite|ste\.|calle|avenida|colonia|calzada))\b/i;
const ZIP_HINT_REGEX = /\b\d{4,6}(-\d{4})?\b/;

const DATE_HINT_REGEX =
  /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+de\s+[a-zñ]+\s+de\s+\d{4})\b/i;

const DESCRIPTION_LABEL_REGEX = /\b(description|descripci[oó]n|concept|concepto|item|service|servicio)\b\s*[:\-]?\s*(.{3,120})/i;

// Códigos de moneda ISO 4217 más comunes en invoices de proveedores extranjeros.
const CURRENCY_CODES = ['USD', 'MXN', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY'];
const CURRENCY_CODES_PATTERN = CURRENCY_CODES.join('|');

const TOTAL_AMOUNT_REGEX = new RegExp(
  `\\b(?:total|amount\\s*due|grand\\s*total|importe\\s*total)\\b\\s*[:\\-]?\\s*(${CURRENCY_CODES_PATTERN})?\\s*\\$?\\s*([\\d,]+\\.\\d{2})\\s*(${CURRENCY_CODES_PATTERN})?`,
  'i'
);

/**
 * Valida el texto extraído de un invoice extranjero (proveedor que no
 * puede emitir CFDI) contra los requisitos de la regla 2.7.1.14 de la RMF.
 * Regresa siempre un veredicto automático (aprobado/rechazado).
 *
 * NOTA: al no existir un formato estandarizado para invoices extranjeros
 * (a diferencia del CFDI), estas validaciones son heurísticas basadas en
 * patrones comunes de dirección/fecha/monto. Se deben ajustar con
 * ejemplos reales de proveedores conforme se detecten falsos negativos.
 *
 * @param {string} text
 * @returns {{ tipoDocumento: string, aprobado: boolean, checks: Array }}
 */
function validateInvoiceExtranjero(text) {
  const checks = [];

  // 1. Nombre/razón social y domicilio de quien lo expide
  const hasAddressHint = ADDRESS_HINT_REGEX.test(text) || ZIP_HINT_REGEX.test(text);
  const hasVendorName = text.trim().length > 0;
  const cumpleEmisor = hasAddressHint && hasVendorName;
  checks.push({
    requisito: 'Nombre/razón social y domicilio de quien expide',
    cumple: cumpleEmisor,
    detalle: cumpleEmisor
      ? 'Se identificó un domicilio (o código postal) en el documento.'
      : 'No se identificó un domicilio del emisor en el documento.',
  });

  // 2. Lugar y fecha de expedición
  const dateMatch = text.match(DATE_HINT_REGEX);
  checks.push({
    requisito: 'Lugar y fecha de expedición',
    cumple: !!dateMatch && hasAddressHint,
    detalle:
      dateMatch && hasAddressHint
        ? `Fecha encontrada: ${dateMatch[0]}, con domicilio/lugar identificado.`
        : !dateMatch
          ? 'No se encontró una fecha de expedición en el documento.'
          : 'Se encontró fecha pero no un lugar de expedición identificable.',
  });

  // 3. Descripción del servicio o bienes
  const descriptionMatch = text.match(DESCRIPTION_LABEL_REGEX);
  checks.push({
    requisito: 'Descripción del servicio o bienes',
    cumple: !!descriptionMatch,
    detalle: descriptionMatch
      ? `Descripción encontrada: "${descriptionMatch[2].trim()}"`
      : 'No se encontró una descripción del servicio o bienes.',
  });

  // 4. RFC o nombre de NAO como receptor
  const textoNormalizado = normalize(text);
  const rfcEncontrado = NAO_RFC_VALIDOS.find((rfc) => textoNormalizado.includes(normalize(rfc)));
  const nombreEncontrado = NAO_NOMBRES_VALIDOS.find((nombre) => textoNormalizado.includes(normalize(nombre)));
  const receptorValido = !!rfcEncontrado || !!nombreEncontrado;
  checks.push({
    requisito: 'RFC o nombre de NAO como receptor',
    cumple: receptorValido,
    detalle: receptorValido
      ? `NAO identificada como receptor (${rfcEncontrado ? `RFC ${rfcEncontrado}` : `nombre "${nombreEncontrado}"`}).`
      : 'No se encontró el RFC ni el nombre de NAO como receptor del documento.',
  });

  // 5. Importe total (solo se exige que esté presente, sin límite de monto)
  const totalMatch = text.match(TOTAL_AMOUNT_REGEX);
  const monedaEncontrada = totalMatch ? (totalMatch[1] || totalMatch[3] || '').toUpperCase() : '';
  checks.push({
    requisito: 'Importe total',
    cumple: !!totalMatch,
    detalle: totalMatch
      ? `Importe total encontrado: ${totalMatch[2]} ${monedaEncontrada}`.trim()
      : 'No se encontró el importe total del documento.',
  });

  // 6. Moneda del importe (debe venir un código de moneda reconocido junto al total)
  checks.push({
    requisito: 'Moneda identificada',
    cumple: !!monedaEncontrada,
    detalle: monedaEncontrada
      ? `Moneda: ${monedaEncontrada}`
      : `No se identificó la moneda del importe total (se esperaba alguno de: ${CURRENCY_CODES.join(', ')}).`,
  });

  const aprobado = checks.every((c) => c.cumple);

  return { tipoDocumento: 'INVOICE_EXTRANJERO', aprobado, checks };
}

module.exports = { validateInvoiceExtranjero };
