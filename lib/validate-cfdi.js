const {
  NAO_RFC_VALIDOS,
  NAO_NOMBRES_VALIDOS,
  REGIMENES_FISCALES_ACEPTADOS,
} = require('../config/company-rules');
const { extractAfterLabel, normalize } = require('./text-fields');
const { UUID_REGEX } = require('./detect-type');

const RFC_TOKEN_REGEX = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi;

// Catálogo SAT c_MetodoPago (no es un dato de negocio de NAO, es fijo).
const METODOS_PAGO_VALIDOS = ['PUE', 'PPD'];

// Leyendas típicas que aparecen en la representación impresa de un CFDI
// cancelado o en un aviso de cancelación.
const CANCELADO_REGEX = /\b(comprobante\s+cancelado|cfdi\s+cancelado|estado\s*:?\s*cancelado|cancelad[oa]\s+ante\s+el\s+sat)\b/i;

/**
 * Busca en todo el documento la primera aparición de cualquiera de los
 * RFC configurados de NAO (sin depender de que venga etiquetado como
 * "Receptor": muchas plantillas de CFDI solo ponen "RFC:" a secas).
 */
function buscarRfcReceptor(text) {
  for (const rfc of NAO_RFC_VALIDOS) {
    const re = new RegExp(`\\b${rfc}\\b`, 'i');
    const match = text.match(re);
    if (match) {
      return { rfc: rfc.toUpperCase(), index: match.index };
    }
  }
  return null;
}

/**
 * Extrae el régimen fiscal buscando cerca de dónde se encontró el RFC del
 * receptor (antes y después), para no confundirlo con el régimen fiscal
 * del emisor cuando ambos aparecen en el documento sin distinción clara.
 */
function buscarRegimenCercaDe(text, index) {
  if (index == null) {
    return extractAfterLabel(text, ['R[eé]gimen\\s*Fiscal'], /(\d{3})/);
  }
  const ventana = text.slice(Math.max(0, index - 150), index + 500);
  return extractAfterLabel(ventana, ['R[eé]gimen\\s*Fiscal'], /(\d{3})/);
}

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

  // 2. El comprobante no debe estar marcado como cancelado (bloqueante)
  const canceladoMatch = text.match(CANCELADO_REGEX);
  checks.push({
    requisito: 'Comprobante no cancelado',
    cumple: !canceladoMatch,
    detalle: canceladoMatch
      ? `Se encontró una leyenda de cancelación: "${canceladoMatch[0]}"`
      : 'No se encontró ninguna leyenda de cancelación en el documento.',
  });

  // 3. RFC del receptor debe coincidir exactamente con el de NAO (bloqueante)
  const rfcReceptor = buscarRfcReceptor(text);
  checks.push({
    requisito: 'RFC del receptor coincide con NAO',
    cumple: !!rfcReceptor,
    detalle: rfcReceptor
      ? `RFC receptor válido: ${rfcReceptor.rfc}`
      : 'No se encontró en el documento ninguno de los RFC configurados de NAO.',
  });

  // 4. Razón social del receptor debe coincidir exactamente con la de NAO (bloqueante)
  const nombreEncontrado = NAO_NOMBRES_VALIDOS.find((nombre) => textoNormalizado.includes(normalize(nombre)));
  checks.push({
    requisito: 'Razón social del receptor coincide con NAO',
    cumple: !!nombreEncontrado,
    detalle: nombreEncontrado
      ? `Razón social encontrada: "${nombreEncontrado}"`
      : 'No se encontró la razón social de NAO en el documento.',
  });

  // 5. Régimen fiscal del receptor debe coincidir con el de NAO (bloqueante)
  const regimen = buscarRegimenCercaDe(text, rfcReceptor ? rfcReceptor.index : null);
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

  // 6. RFC del emisor (informativo: solo se muestra, no bloquea). Se toma el
  // primer RFC del documento que no sea uno de los RFC configurados de NAO.
  const todosLosRfc = text.match(RFC_TOKEN_REGEX) || [];
  const rfcEmisor = todosLosRfc.find(
    (rfc) => !NAO_RFC_VALIDOS.some((naoRfc) => naoRfc.toUpperCase() === rfc.toUpperCase())
  );
  checks.push({
    requisito: 'RFC del emisor',
    cumple: !!rfcEmisor,
    detalle: rfcEmisor ? `RFC emisor: ${rfcEmisor.toUpperCase()}` : 'No se encontró el RFC del emisor.',
    informativo: true,
  });

  // 7. Uso de CFDI (informativo: varía según el tipo de gasto, no se valida contra lista fija)
  const usoCfdi = extractAfterLabel(text, ['Uso\\s*(?:de\\s*)?CFDI'], /([A-Z]\d{2})/i);
  checks.push({
    requisito: 'Uso de CFDI',
    cumple: !!usoCfdi,
    detalle: usoCfdi ? `Uso de CFDI: ${usoCfdi.toUpperCase()}` : 'No se encontró el uso de CFDI.',
    informativo: true,
  });

  // 8. Método de pago: informativo, pero si se detecta debe ser PUE o PPD
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
