const UUID_REGEX = /\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/i;
const FOLIO_FISCAL_LABEL_REGEX = /folio\s*fiscal|timbre\s*fiscal\s*digital|sello\s*digital\s*del\s*cfdi/i;

/**
 * Detecta si el texto extraído corresponde a un CFDI nacional (tiene folio
 * fiscal / UUID de timbrado) o a un invoice extranjero (no lo tiene).
 *
 * @param {string} text
 * @returns {'CFDI_NACIONAL' | 'INVOICE_EXTRANJERO'}
 */
function detectDocumentType(text) {
  const hasUuid = UUID_REGEX.test(text);
  const hasFolioFiscalLabel = FOLIO_FISCAL_LABEL_REGEX.test(text);

  if (hasUuid || hasFolioFiscalLabel) {
    return 'CFDI_NACIONAL';
  }

  return 'INVOICE_EXTRANJERO';
}

module.exports = { detectDocumentType, UUID_REGEX };
