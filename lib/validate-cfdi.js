const {
  NAO_RFC_VALIDOS,
  REGIMENES_FISCALES_ACEPTADOS,
  USOS_CFDI_VALIDOS,
  CODIGOS_POSTALES_VALIDOS,
  DIAS_MAXIMOS_ANTIGUEDAD,
  MONTO_MAXIMO,
} = require('../config/company-rules');
const { extractAfterLabel, parseFlexibleDate } = require('./text-fields');
const { UUID_REGEX } = require('./detect-type');

const RFC_VALUE_REGEX = /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i;

/**
 * Valida el texto extraído de un CFDI nacional contra las reglas de NAO.
 * Regresa siempre un veredicto automático (aprobado/rechazado), sin
 * estados intermedios de "revisión manual".
 *
 * @param {string} text
 * @returns {{ tipoDocumento: string, aprobado: boolean, checks: Array }}
 */
function validateCFDI(text) {
  const checks = [];

  // 1. Folio fiscal / UUID de timbrado
  const uuidMatch = text.match(UUID_REGEX);
  checks.push({
    requisito: 'Folio fiscal (UUID) de timbrado',
    cumple: !!uuidMatch,
    detalle: uuidMatch
      ? `UUID encontrado: ${uuidMatch[0]}`
      : 'No se encontró un folio fiscal (UUID) en el documento.',
  });

  // 2. RFC del emisor
  const rfcEmisor = extractAfterLabel(text, ['RFC\\s*(?:del\\s*)?Emisor', 'Emisor[\\s\\S]{0,25}?RFC'], RFC_VALUE_REGEX);
  checks.push({
    requisito: 'RFC del emisor',
    cumple: !!rfcEmisor,
    detalle: rfcEmisor ? `RFC emisor: ${rfcEmisor}` : 'No se encontró el RFC del emisor.',
  });

  // 3. RFC del receptor + que sea uno de los RFC autorizados de NAO
  const rfcReceptor = extractAfterLabel(text, ['RFC\\s*(?:del\\s*)?Receptor', 'Receptor[\\s\\S]{0,25}?RFC'], RFC_VALUE_REGEX);
  const rfcReceptorNormalizado = rfcReceptor ? rfcReceptor.toUpperCase() : null;
  const receptorAutorizado = !!rfcReceptorNormalizado && NAO_RFC_VALIDOS.includes(rfcReceptorNormalizado);
  checks.push({
    requisito: 'Receptor con RFC autorizado de NAO',
    cumple: receptorAutorizado,
    detalle: rfcReceptorNormalizado
      ? receptorAutorizado
        ? `RFC receptor autorizado: ${rfcReceptorNormalizado}`
        : `RFC receptor "${rfcReceptorNormalizado}" no está en la lista de RFC autorizados de NAO.`
      : 'No se encontró el RFC del receptor.',
  });

  // 4. Código postal del receptor
  const cpReceptor = extractAfterLabel(text, ['C\\.?P\\.?', 'C[oó]digo\\s*Postal'], /(\d{5})/);
  const cpValido = !!cpReceptor && CODIGOS_POSTALES_VALIDOS.includes(cpReceptor);
  checks.push({
    requisito: 'Código postal del receptor',
    cumple: cpValido,
    detalle: cpReceptor
      ? cpValido
        ? `Código postal válido: ${cpReceptor}`
        : `Código postal "${cpReceptor}" no coincide con los configurados para NAO.`
      : 'No se encontró el código postal del receptor.',
  });

  // 5. Régimen fiscal
  const regimen = extractAfterLabel(text, ['R[eé]gimen\\s*Fiscal'], /(\d{3})/);
  const regimenValido = !!regimen && REGIMENES_FISCALES_ACEPTADOS.includes(regimen);
  checks.push({
    requisito: 'Régimen fiscal aceptado',
    cumple: regimenValido,
    detalle: regimen
      ? regimenValido
        ? `Régimen fiscal válido: ${regimen}`
        : `Régimen fiscal "${regimen}" no está en la lista de régimenes aceptados.`
      : 'No se encontró el régimen fiscal.',
  });

  // 6. Uso de CFDI
  const usoCfdi = extractAfterLabel(text, ['Uso\\s*(?:de\\s*)?CFDI'], /([A-Z]\d{2})/i);
  const usoCfdiNormalizado = usoCfdi ? usoCfdi.toUpperCase() : null;
  const usoValido = !!usoCfdiNormalizado && USOS_CFDI_VALIDOS.includes(usoCfdiNormalizado);
  checks.push({
    requisito: 'Uso de CFDI válido',
    cumple: usoValido,
    detalle: usoCfdiNormalizado
      ? usoValido
        ? `Uso de CFDI válido: ${usoCfdiNormalizado}`
        : `Uso de CFDI "${usoCfdiNormalizado}" no está en la lista de usos aceptados.`
      : 'No se encontró el uso de CFDI.',
  });

  // 7. Fecha de emisión dentro del plazo máximo configurado
  const fechaRaw = extractAfterLabel(text, ['Fecha\\s*(?:de\\s*)?Emisi[oó]n'], /(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/);
  let fechaValida = false;
  let detalleFecha;
  if (fechaRaw) {
    const fecha = parseFlexibleDate(fechaRaw);
    if (fecha) {
      const diffDias = Math.floor((Date.now() - fecha.getTime()) / 86400000);
      fechaValida = diffDias >= 0 && diffDias <= DIAS_MAXIMOS_ANTIGUEDAD;
      detalleFecha = fechaValida
        ? `Fecha de emisión ${fechaRaw} dentro del plazo (${diffDias} días de antigüedad).`
        : `Fecha de emisión ${fechaRaw} fuera del plazo permitido (${diffDias} días, máximo ${DIAS_MAXIMOS_ANTIGUEDAD}).`;
    } else {
      detalleFecha = `Se encontró una fecha (${fechaRaw}) pero no se pudo interpretar su formato.`;
    }
  } else {
    detalleFecha = 'No se encontró la fecha de emisión.';
  }
  checks.push({
    requisito: `Fecha de emisión dentro de ${DIAS_MAXIMOS_ANTIGUEDAD} días`,
    cumple: fechaValida,
    detalle: detalleFecha,
  });

  // 8. Monto dentro del máximo configurado
  const montoRaw = extractAfterLabel(text, ['Total'], /\$?\s*([\d,]+\.\d{2})/);
  let montoValido = false;
  let detalleMonto;
  if (montoRaw) {
    const monto = parseFloat(montoRaw.replace(/,/g, ''));
    montoValido = MONTO_MAXIMO == null || monto <= MONTO_MAXIMO;
    detalleMonto = montoValido
      ? `Monto ${monto.toFixed(2)} dentro del máximo permitido${MONTO_MAXIMO != null ? ` (${MONTO_MAXIMO})` : ''}.`
      : `Monto ${monto.toFixed(2)} excede el máximo permitido (${MONTO_MAXIMO}).`;
  } else {
    detalleMonto = 'No se encontró el monto total del comprobante.';
  }
  checks.push({
    requisito: 'Monto dentro del máximo permitido',
    cumple: montoValido,
    detalle: detalleMonto,
  });

  const aprobado = checks.every((c) => c.cumple);

  return { tipoDocumento: 'CFDI_NACIONAL', aprobado, checks };
}

module.exports = { validateCFDI };
