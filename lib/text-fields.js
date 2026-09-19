/**
 * Utilidades genéricas de extracción de campos por texto plano.
 * No conocen nada de reglas de negocio; solo saben buscar patrones.
 */

/**
 * Busca la primera etiqueta (de una lista de variantes) seguida de un
 * valor que matchee `valueRegex`, y regresa ese valor.
 *
 * @param {string} text
 * @param {string[]} labelPatterns - fragmentos de regex (sin flags) para las etiquetas
 * @param {RegExp} valueRegex - regex (con un grupo de captura) para el valor esperado
 * @returns {string|null}
 */
function extractAfterLabel(text, labelPatterns, valueRegex) {
  for (const label of labelPatterns) {
    const re = new RegExp(label + '\\s*[:\\-]?\\s*' + valueRegex.source, 'i');
    const match = text.match(re);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Normaliza texto para comparaciones insensibles a acentos/mayúsculas.
 */
function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Convierte una fecha en formato "YYYY-MM-DD" o "DD/MM/YYYY" a objeto Date (UTC).
 * Regresa null si no puede interpretarla.
 */
function parseFlexibleDate(raw) {
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }

  return null;
}

module.exports = { extractAfterLabel, normalize, parseFlexibleDate };
