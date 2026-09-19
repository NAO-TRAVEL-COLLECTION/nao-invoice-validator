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
todos los valores específicos de NAO (marcados con `// TODO`):

- `NAO_RFC_VALIDOS` — RFC(s) de NAO como receptor autorizado.
- `NAO_NOMBRES_VALIDOS` — razón(es) social(es) de NAO (para invoices
  extranjeros que la referencian por nombre y no por RFC).
- `REGIMENES_FISCALES_ACEPTADOS` — claves SAT de régimen fiscal.
- `USOS_CFDI_VALIDOS` — claves de uso de CFDI aceptadas.
- `CODIGOS_POSTALES_VALIDOS` — CP del domicilio fiscal de NAO.
- `DIAS_MAXIMOS_ANTIGUEDAD` — plazo máximo en días entre la fecha de
  emisión y hoy.
- `MONTO_MAXIMO` — monto máximo permitido por factura (o `null` si no
  hay límite).

Hasta que tu contador confirme estos valores, la app funcionará pero
rechazará documentos por defecto en esos criterios (son placeholders).

Ningún otro archivo debería necesitar edición para ajustar estas reglas.

## Cómo funciona la validación (y sus límites)

- El **CFDI nacional** se valida buscando etiquetas típicas de la
  representación impresa del CFDI (ej. "RFC Receptor", "Uso CFDI",
  "Régimen Fiscal", "Fecha de Emisión", "Total"). Esto funciona bien con
  los formatos más comunes de PDF de CFDI, pero puede variar entre
  proveedores/facturadores.
- El **invoice extranjero** no tiene un formato estandarizado, así que
  la validación usa heurísticas (patrones de dirección, fecha, montos y
  presencia del nombre/RFC de NAO). Es más permisiva por diseño, pero
  también más propensa a falsos negativos con formatos poco comunes.
- Si al probar con facturas reales detectas que algún patrón no se
  reconoce bien, se puede ajustar la extracción en `lib/validate-cfdi.js`
  y `lib/validate-invoice.js` sin tocar la configuración de negocio.
- Este es un punto de partida pensado para iterar: cuando definas
  requisitos más específicos, se ajustan estos archivos.

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
