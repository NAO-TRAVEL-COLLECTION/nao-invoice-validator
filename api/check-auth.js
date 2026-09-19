const { isAuthorized } = require('../lib/auth');

/**
 * Endpoint ligero solo para validar la contraseña antes de mostrar la app.
 * No procesa archivos.
 */
module.exports = function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true });
};
