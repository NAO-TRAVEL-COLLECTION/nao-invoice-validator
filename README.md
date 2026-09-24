# NAO Travel Collection — Validador de Facturas

Aplicación web para validar automáticamente si una factura en PDF (CFDI
nacional mexicano o invoice extranjero) cumple los requisitos necesarios
para ser procesada para pago. El veredicto (aprobada/rechazada) siempre
es automático: no hay estados de "revisión manual".

Detecta el tipo de documento automáticamente:

- **CFDI nacional**: si el PDF contiene un folio fiscal (UUID de
  timbrado), se valida contra las reglas de CFDI.
- **Invoice extranjero**: si no lo contiene, se valida contra los
  requisitos de la regla 2.7.1.14 de la RMF.

Se pueden subir uno o varios PDFs a la vez; cada uno se valida por
separado.

## ⚠️ Archivo que debes editar con los datos reales de la empresa

**[`config/company-rules.js`](config/company-rules.js)** — ahí viven
todos los valores específicos de NAO:

- `NAO_RFC_VALIDOS` — RFC(s) de NAO como receptor autorizado.
- `NAO_NOMBRES_VALIDOS` — razón(es) social(es) de NAO.
- `REGIMENES_FISCALES_ACEPTADOS` — claves SAT de régimen fiscal aceptadas.
- `CODIGOS_POSTALES_VALIDOS` — código(s) postal(es) del domicilio fiscal de NAO.

Ningún otro archivo debería necesitar edición para ajustar estos valores.

## Reglas de validación

### CFDI nacional

Se aprueba solo si se cumple todo lo siguiente:

- El documento tiene folio fiscal (UUID de timbrado) — sin eso no es un
  CFDI válido.
- No trae ninguna leyenda de cancelación.
- RFC del receptor coincide con el de NAO.
- Razón social del receptor coincide con la de NAO (comparación
  insensible a mayúsculas/acentos).
- Régimen fiscal del receptor coincide con el de NAO.
- Código postal del receptor coincide con el de NAO.
- La forma de pago **no** es "01 Efectivo" — un pago en efectivo no es
  deducible, así que se rechaza automáticamente.

Estos otros campos se extraen y se muestran en el resultado, pero
**nunca causan un rechazo** (aparecen marcados como "informativo"):

- RFC del emisor
- Uso de CFDI (varía según el tipo de gasto, no hay una lista fija)
- Método de pago (se muestra si es PUE/PPD, pero no bloquea)

No hay límite de antigüedad (días) ni de monto máximo.

### Invoice extranjero

Se valida contra los elementos mínimos de la regla 2.7.1.14 de la RMF:
nombre/razón social y domicilio del emisor, lugar y fecha de expedición,
descripción del servicio o bienes, RFC o nombre de NAO como receptor, e
importe total (sin límite de monto). No se valida retención de ISR ni
vigencia del comprobante ante el SAT — ambas cosas quedan fuera de
alcance de esta validación.

### Límites conocidos de la extracción

Al no existir un formato estandarizado para CFDIs impresos ni para
invoices extranjeros, la extracción de campos usa patrones/etiquetas
comunes (ej. "RFC Receptor", "Régimen Fiscal Receptor"). Esto funciona
bien con los formatos más comunes, pero puede variar entre proveedores.
Si detectas que algún patrón no se reconoce bien con facturas reales, se
ajusta en `lib/validate-cfdi.js` y `lib/validate-invoice.js` sin tocar
la configuración de negocio.

## Seguridad

- Los PDFs se procesan **en memoria únicamente**; nunca se escriben a
  disco ni se guardan de forma permanente.
- El texto extraído de los PDFs **nunca se incluye en logs**.
- No se usa ningún servicio de IA ni se envían datos a terceros; toda la
  validación es local, determinística, por extracción de texto y reglas.
- **El formulario no tiene ninguna protección de acceso** — cualquiera
  con el link puede usarlo. Si en algún momento se necesita restringir el
  acceso, se puede volver a agregar una contraseña simple o usar la
  protección de despliegue de Vercel.

## Desarrollo local

```bash
npm install
npm install -g vercel   # si no lo tienes
vercel dev
```

Vercel te pedirá vincular el proyecto la primera vez. Abre
`http://localhost:3000`.

## Despliegue en Vercel

1. Conecta el repositorio de GitHub a un proyecto nuevo en Vercel (o usa
   `vercel --prod` desde la CLI ya vinculada al proyecto).
2. Despliega:
   ```bash
   vercel --prod
   ```

No hay paso de build ni variables de entorno requeridas: es HTML/CSS/JS
estático (`public/`) + funciones serverless de Node (`api/`).

## Estructura del proyecto

```
public/            Frontend estático (formulario, estilos, lógica de UI)
api/                Funciones serverless (Vercel)
  validate.js         Procesa y valida los PDFs subidos
lib/                Lógica de negocio, reutilizable y sin dependencias de Vercel
  pdf-extract.js        Extracción de texto de PDF
  detect-type.js        Detección CFDI vs invoice extranjero
  validate-cfdi.js      Reglas de validación de CFDI
  validate-invoice.js   Reglas de validación de invoice extranjero
  text-fields.js        Utilidades genéricas de extracción de texto
config/
  company-rules.js      Valores específicos de NAO (editar aquí)
```
