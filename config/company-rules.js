/**
 * Reglas específicas de NAO Travel Collection.
 *
 * Este es el ÚNICO archivo que se debe editar con los datos reales
 * de la empresa una vez que el contador los confirme. Todo lo demás
 * en el código es lógica genérica de validación.
 *
 * IMPORTANTE: hay valores marcados con TODO que son placeholders y
 * DEBEN reemplazarse antes de usar esto en producción para pagos reales.
 */

module.exports = {
  /**
   * RFC(s) autorizados de NAO Travel Collection como receptor del CFDI.
   * Si la empresa factura desde más de un RFC (distintas razones sociales),
   * agrega todos aquí. La validación acepta cualquiera de la lista.
   * TODO: confirmar con el contador el/los RFC(s) reales de NAO.
   */
  NAO_RFC_VALIDOS: [
    'TODO000000AAA', // TODO: reemplazar con el RFC real de NAO Travel Collection
  ],

  /**
   * Nombre(s) / razón(es) social(es) con los que NAO puede aparecer como
   * receptor en un invoice extranjero (que no lleva RFC, solo nombre).
   * Se acepta coincidencia si el texto del documento contiene alguno de
   * estos nombres (comparación insensible a mayúsculas/acentos).
   * TODO: confirmar la razón social exacta con el contador.
   */
  NAO_NOMBRES_VALIDOS: [
    'TODO NAO TRAVEL COLLECTION', // TODO: reemplazar con la razón social real
  ],

  /**
   * Régimen(es) fiscal(es) del receptor (NAO) que se aceptan en el CFDI.
   * Clave SAT, ej. "601" (General de Ley Personas Morales).
   * TODO: confirmar régimen fiscal real de NAO con el contador.
   */
  REGIMENES_FISCALES_ACEPTADOS: [
    'TODO', // TODO: ej. '601'
  ],

  /**
   * Claves de "Uso de CFDI" que se consideran válidas para estas facturas.
   * TODO: confirmar con el contador qué usos de CFDI son aceptables
   * (ej. 'G03' Gastos en general, 'I08' Otra maquinaria y equipo, etc.)
   */
  USOS_CFDI_VALIDOS: [
    'TODO', // TODO: ej. 'G03'
  ],

  /**
   * Código(s) postal(es) válidos para el domicilio fiscal del receptor.
   * Si NAO tiene un único domicilio fiscal, el CP del CFDI receptor debe
   * coincidir con alguno de estos.
   * TODO: confirmar código(s) postal(es) real(es) de NAO.
   */
  CODIGOS_POSTALES_VALIDOS: [
    'TODO', // TODO: ej. '06600'
  ],

  /**
   * Antigüedad máxima permitida (en días) entre la fecha de emisión del
   * comprobante y la fecha de validación/hoy, para que sea aceptada.
   * TODO: confirmar plazo real con el contador (ej. 30, 60, 90 días).
   */
  DIAS_MAXIMOS_ANTIGUEDAD: 30, // TODO: confirmar valor real

  /**
   * Monto máximo permitido por factura/invoice, en la moneda del documento.
   * Si no hay límite, dejar null.
   * TODO: confirmar el monto máximo real que se autoriza sin aprobación
   * adicional (o si no existe límite).
   */
  MONTO_MAXIMO: 100000, // TODO: confirmar valor real (o null si no aplica)
};
