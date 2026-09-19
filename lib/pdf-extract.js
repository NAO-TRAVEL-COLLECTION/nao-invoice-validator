const { extractText: unpdfExtractText, getDocumentProxy } = require('unpdf');

/**
 * Extrae el texto plano de un PDF a partir de su buffer en memoria.
 * No escribe nada a disco ni conserva el buffer más allá de esta llamada.
 *
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractText(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await unpdfExtractText(pdf, { mergePages: true });
  return text || '';
}

module.exports = { extractText };
