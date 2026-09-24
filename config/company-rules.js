/**
 * Reglas específicas de NAO Travel Collection.
 *
 * Este es el ÚNICO archivo que se debe editar con los datos reales
 * de la empresa. Todo lo demás en el código es lógica genérica de
 * validación.
 */

module.exports = {
  /**
   * RFC(s) autorizados de NAO Travel Collection como receptor del CFDI.
   * Si la empresa factura desde más de un RFC, agrega todos aquí.
   */
  NAO_RFC_VALIDOS: ['NCR2001161R6'],

  /**
   * Nombre(s) / razón(es) social(es) con los que NAO puede aparecer como
   * receptor (CFDI o invoice extranjero). Se acepta coincidencia si el
   * texto del documento contiene alguno de estos nombres (comparación
   * insensible a mayúsculas/acentos).
   */
  NAO_NOMBRES_VALIDOS: ['NAO CRUISES'],

  /**
   * Régimen(es) fiscal(es) del receptor (NAO) que se aceptan en el CFDI.
   * Clave SAT: "601" = General de Ley Personas Morales.
   */
  REGIMENES_FISCALES_ACEPTADOS: ['601'],

  /**
   * Código(s) postal(es) del domicilio fiscal de NAO. Si NAO tiene más de
   * un domicilio fiscal, agrega todos aquí.
   */
  CODIGOS_POSTALES_VALIDOS: ['11650'],
};
