const Busboy = require('busboy');
const { extractText } = require('../lib/pdf-extract');
const { detectDocumentType } = require('../lib/detect-type');
const { validateCFDI } = require('../lib/validate-cfdi');
const { validateInvoiceExtranjero } = require('../lib/validate-invoice');

/**
 * Lee el body multipart/form-data del request y regresa la lista de
 * archivos subidos como buffers en memoria. No escribe nada a disco.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Array<{ filename: string, buffer: Buffer }>>}
 */
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: 15 * 1024 * 1024, // 15 MB por archivo
        files: 20,
      },
    });

    const files = [];

    busboy.on('file', (_fieldname, fileStream, info) => {
      const { filename } = info;
      const chunks = [];

      fileStream.on('data', (chunk) => chunks.push(chunk));
      fileStream.on('limit', () => {
        reject(new Error(`El archivo "${filename}" excede el tamaño máximo permitido (15 MB).`));
      });
      fileStream.on('end', () => {
        files.push({ filename, buffer: Buffer.concat(chunks) });
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => resolve(files));

    req.pipe(busboy);
  });
}

/**
 * Procesa un solo PDF: extrae texto, detecta tipo y valida.
 * El texto extraído nunca se persiste ni se incluye en logs.
 */
async function processPdf(filename, buffer) {
  try {
    const text = await extractText(buffer);

    if (!text || !text.trim()) {
      return {
        archivo: filename,
        tipoDocumento: null,
        aprobado: false,
        checks: [],
        error: 'No se pudo extraer texto del PDF (¿está escaneado como imagen o vacío?).',
      };
    }

    const tipoDocumento = detectDocumentType(text);
    const resultado =
      tipoDocumento === 'CFDI_NACIONAL' ? validateCFDI(text) : validateInvoiceExtranjero(text);

    return { archivo: filename, ...resultado };
  } catch (err) {
    return {
      archivo: filename,
      tipoDocumento: null,
      aprobado: false,
      checks: [],
      error: `Error al procesar el PDF: ${err.message}`,
    };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  let files;
  try {
    files = await parseMultipart(req);
  } catch (err) {
    res.status(400).json({ error: err.message || 'No se pudo leer el formulario.' });
    return;
  }

  if (!files.length) {
    res.status(400).json({ error: 'No se recibió ningún archivo PDF.' });
    return;
  }

  const resultados = await Promise.all(files.map((f) => processPdf(f.filename, f.buffer)));

  // Los buffers de los PDFs salen de alcance aquí; no se guardan ni se loggean.
  res.status(200).json({ resultados });
};
