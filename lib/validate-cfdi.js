const {
  NAO_RFC_VALIDOS,
  NAO_NOMBRES_VALIDOS,
  REGIMENES_FISCALES_ACEPTADOS,
} = require('../config/company-rules');
const { extractAfterLabel, normalize } = require('./text-fields');
const { UUID_REGEX } = require('./detect-type');

const RFC_VALUE_REGEX = /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/i;

// Catálogo SAT c_MetodoPago (no es un dato de negocio de NAO, es fijo).
const METODOS_PAGO_VALIDOS = ['PUE', 'PPD'];

/**
 * Valida el texto extraído de un CFDI nacional contra las reglas de NAO.
 * Regresa siempre un veredicto automático (aprobado/rechazado), sin
 * estados intermedios de "revisión manual".
 *
 * El veredicto de aprobación solo depende de los checks marcados como
 * bloqueantes (sin `informativo: true`). Los checks informativos se
 * extraen y se muestran, pero nunca causan un rechazo.
 *
 * @param {string} text
 * @returns {{ tipoDocumento: string, aprobado: boolean, checks: Array }}
 */
function validateCFDI(text) {
  const checks = [];
  const textoNormalizado = normalize(text);

  // 1. Folio fiscal / UUID de timbrado (bloqueante: sin esto no es un CFDI válido)
  const uuidMatch = text.match(UUID_REGEX);
  checks.push({
    requisito: 'Folio fiscal (UUID) de timbrado',
    cumple: !!uuidMatch,
    detalle: uuidMatch
      ? `UUID encontrado: ${uuidMatch[0]}`
      : 'No se encontró un folio fiscal (UUID) en el documento.',
  });

  // 2. RFC del receptor debe coincidir exactamente con el de NAO (bloqueante)
  const rfcReceptor = extractAfterLabel(text, ['RFC\\s*(?:del\\s*)?Receptor', 'Receptor[\\s\\S]{0,25}?RFC'], RFC_VALUE_REGEX);
  const rfcReceptorNormalizado = rfcReceptor ? rfcReceptor.toUpperCase() : null;
  const rfcValido = !!rfcReceptorNormalizado && NAO_RFC_VALIDOS.includes(rfcReceptorNormalizado);
  checks.push({
    requisito: 'RFC del receptor coincide con NAO',
    cumple: rfcValido,
    detalle: rfcReceptorNormalizado
      ? rfcValido
        ? `RFC receptor válido: ${rfcReceptorNormalizado}`
        : `RFC receptor "${rfcReceptorNormalizado}" no coincide con el RFC de NAO.`
      : 'No se encontró el RFC del receptor.',
  });

  // 3. Razón social del receptor debe coincidir exactamente con la de NAO (bloqueante)
  const nombreEncontrado = NAO_NOMBRES_VALIDOS.find((nombre) => textoNormalizado.includes(normalize(nombre)));
  checks.push({
    requisito: 'Razón social del receptor coincide con NAO',
    cumple: !!nombreEncontrado,
    detalle: nombreEncontrado
      ? `Razón social encontrada: "${nombreEncontrado}"`
      : 'No se encontró la razón social de NAO en el documento.',
  });

  // 4. Régimen fiscal del receptor debe coincidir con el de NAO (bloqueante)
  const regimen = extractAfterLabel(
    text,
    ['R[eé]gimen\\s*Fiscal\\s*(?:del\\s*)?Receptor', 'R[eé]gimen\\s*Fiscal'],
    /(\d{3})/
  );
  const regimenValido = !!regimen && REGIMENES_FISCALES_ACEPTADOS.includes(regimen);
  checks.push({
    requisito: 'Régimen fiscal del receptor coincide con NAO',
    cumple: regimenValido,
    detalle: regimen
      ? regimenValido
        ? `Régimen fiscal válido: ${regimen}`
        : `Régimen fiscal "${regimen}" no coincide con el de NAO.`
      : 'No se encontró el régimen fiscal del receptor.',
  });

  // 5. RFC del emisor (informativo: solo se muestra, no bloquea)
  const rfcEmisor = extractAfterLabel(text, ['RFC\\s*(?:del\\s*)?Emisor', 'Emisor[\\s\\S]{0,25}?RFC'], RFC_VALUE_REGEX);
  checks.push({
    requisito: 'RFC del emisor',
    cumple: !!rfcEmisor,
    detalle: rfcEmisor ? `RFC emisor: ${rfcEmisor}` : 'No se encontró el RFC del emisor.',
    informativo: true,
  });

  // 6. Uso de CFDI (informativo: varía según el tipo de gasto, no se valida contra lista fija)
  const usoCfdi = extractAfterLabel(text, ['Uso\\s*(?:de\\s*)?CFDI'], /([A-Z]\d{2})/i);
  checks.push({
    requisito: 'Uso de CFDI',
    cumple: !!usoCfdi,
    detalle: usoCfdi ? `Uso de CFDI: ${usoCfdi.toUpperCase()}` : 'No se encontró el uso de CFDI.',
    informativo: true,
  });

  // 7. Método de pago: informativo, pero si se detecta debe ser PUE o PPD
  const metodoPago = extractAfterLabel(
    text,
    ['M[eé]todo\\s*(?:de\\s*)?Pago', 'Forma\\s*(?:de\\s*)?Pago'],
    /(PUE|PPD)/i
  );
  const metodoPagoNormalizado = metodoPago ? metodoPago.toUpperCase() : null;
  checks.push({
    requisito: 'Método de pago (PUE o PPD)',
    cumple: !!metodoPagoNormalizado && METODOS_PAGO_VALIDOS.includes(metodoPagoNormalizado),
    detalle: metodoPagoNormalizado
      ? `Método de pago: ${metodoPagoNormalizado}`
      : 'No se encontró el método de pago (PUE/PPD).',
    informativo: true,
  });

  const aprobado = checks.filter((c) => !c.informativo).every((c) => c.cumple);

  return { tipoDocumento: 'CFDI_NACIONAL', aprobado, checks };
}

module.exports = { validateCFDI };
