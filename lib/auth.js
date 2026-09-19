/**
 * Validación simple de acceso por contraseña compartida.
 * La contraseña vive en la variable de entorno APP_PASSWORD (Vercel).
 */

function isAuthorized(req) {
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    // Si no hay contraseña configurada en el entorno, no se permite acceso.
    // Evita quedar abierto por accidente si falta configurar la env var.
    return false;
  }

  const provided = req.headers['x-app-password'];
  return typeof provided === 'string' && provided === expected;
}

module.exports = { isAuthorized };
