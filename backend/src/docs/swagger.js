import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJSDoc from "swagger-jsdoc";
import { env } from "../config/env.js";

// Ruta absoluta (con "/" para que el glob funcione en Windows), independiente del directorio de arranque.
const srcDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const routesGlob = path.join(srcDir, "modules", "**", "*.routes.js").replaceAll("\\", "/");

const errorResponse = (message, errors) => ({
  description: message,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
      example: { success: false, message, ...(errors && { errors }) },
    },
  },
});

const imagenMultipart = (campo, maximo) => ({
  required: true,
  description:
    `Imagen JPEG, PNG o WebP de hasta ${maximo} (HEIC no: convertir a JPEG antes). Se validan los bytes, ` +
    "no la extensión; se quitan los metadatos (EXIF, GPS) y se reduce a 2048 px como máximo.",
  content: {
    "multipart/form-data": {
      schema: {
        type: "object",
        required: [campo],
        properties: { [campo]: { type: "string", format: "binary" } },
      },
    },
  },
});

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PetCat API",
      version: "1.0.0",
      description:
        "API de PetCat: panel web para negocios de mascotas (B2B) y app móvil para dueños (B2C).\n\n" +
        "Todas las respuestas usan `{ success, message, data, meta? }` y los errores " +
        "`{ success: false, message, errors? }`.",
    },
    // La relativa apunta al mismo servidor que sirve esta documentación (localhost, IP de la
    // red local o dominio); APP_URL queda para clientes que leen docs.json desde fuera.
    servers: [
      { url: "/api/v1", description: "Este servidor" },
      { url: `${env.APP_URL}/api/v1`, description: "APP_URL" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Detalle por campo (solo en algunos errores)",
            },
          },
        },
        ArchivoPrivado: {
          type: "object",
          description:
            "Archivo privado (historial o comprobante). `url` es una URL firmada que vence en `url_expira_en` " +
            "(15 minutos por defecto): no se guarda; al vencer se vuelve a pedir el registro. Con `externo: true` " +
            "es una URL guardada antes de la subida de archivos (sin firma ni vencimiento, sin `id_archivo`).",
          properties: {
            // Los archivos `externo` solo traen `url` y `externo`.
            id_archivo: { type: "integer", example: 31, "x-opcional": true },
            tipo: { type: "string", enum: ["imagen", "pdf"], "x-opcional": true },
            nombre: { type: "string", nullable: true, example: "radiografia.jpg", "x-opcional": true },
            bytes: { type: "integer", example: 184320, "x-opcional": true },
            url: { type: "string", example: "https://api.cloudinary.com/v1_1/<cloud>/image/download?..." },
            url_expira_en: {
              type: "string",
              format: "date-time",
              example: "2026-09-28T15:31:16.000Z",
              "x-opcional": true,
            },
            externo: { type: "boolean", example: false },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer", example: 45 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            totalPages: { type: "integer", example: 3 },
            hasNext: { type: "boolean", example: true },
          },
        },
      },
      // Subida de una imagen pública (multipart/form-data con un solo archivo).
      requestBodies: {
        Foto: imagenMultipart("foto", "5 MB"),
        Logo: imagenMultipart("logo", "5 MB"),
        Banner: imagenMultipart("banner", "8 MB"),
        Comprobante: {
          required: true,
          description:
            "Foto (JPEG, PNG o WebP) o PDF de hasta 10 MB. Las imágenes se guardan sin metadatos (EXIF, GPS). " +
            "HEIC no: convertir a JPEG antes.",
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["comprobante"],
                properties: { comprobante: { type: "string", format: "binary" } },
              },
            },
          },
        },
        ArchivosHistorial: {
          required: true,
          description:
            "Hasta 5 archivos por envío en el campo `archivos` (repetido), cada uno imagen JPEG/PNG/WebP o PDF de " +
            "hasta 10 MB. Un registro admite 10 archivos en total.",
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["archivos"],
                properties: { archivos: { type: "array", maxItems: 5, items: { type: "string", format: "binary" } } },
              },
            },
          },
        },
      },
      parameters: {
        page: {
          in: "query",
          name: "page",
          schema: { type: "integer", minimum: 1, default: 1 },
        },
        limit: {
          in: "query",
          name: "limit",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
      },
      // Uso en JSDoc: `401: { $ref: '#/components/responses/Unauthorized' }`
      responses: {
        BadRequest: errorResponse("Solicitud inválida"),
        Unauthorized: errorResponse("Token requerido"),
        Forbidden: errorResponse("No tienes permiso para realizar esta acción"),
        // Sin permiso (403 genérico) o límite del plan alcanzado (con errors.plan).
        ForbiddenOrPlanLimit: {
          description:
            "Sin permiso, o el negocio alcanzó el límite de su plan (`errors.plan`; ver `GET /negocios/{id_negocio}/suscripcion`)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                sinPermiso: { value: { success: false, message: "No tienes permiso para realizar esta acción" } },
                limitePlan: {
                  value: {
                    success: false,
                    message: "Tu plan Gratuito permite hasta 1 sucursal activa. Mejora tu plan para continuar.",
                    errors: { plan: "Límite de sucursales alcanzado (1 de 1)" },
                  },
                },
              },
            },
          },
        },
        NotFound: errorResponse("Recurso no encontrado"),
        Conflict: errorResponse("Ya existe un registro con esos datos"),
        ValidationError: errorResponse("Datos inválidos", {
          email: "Correo electrónico inválido",
          nombre: "Campo obligatorio",
        }),
        TooManyRequests: errorResponse("Demasiadas solicitudes, intenta de nuevo en unos minutos"),
        ArchivoInvalido: errorResponse("Archivo inválido", {
          archivo: "Tipo de archivo no admitido: debe ser JPEG, PNG o WebP",
        }),
        AlmacenamientoNoDisponible: errorResponse("No se pudo guardar el archivo, intenta de nuevo"),
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [routesGlob],
});

/** Nombres de los esquemas a los que se llega desde un objeto (por $ref), sin repetir. */
const referencias = (nodo, encontrados = new Set()) => {
  if (!nodo || typeof nodo !== "object") return encontrados;
  if (typeof nodo.$ref === "string") encontrados.add(nodo.$ref.split("/").pop());
  for (const valor of Object.values(nodo)) referencias(valor, encontrados);
  return encontrados;
};

/** Respuesta de una operación, siguiendo `$ref` a components.responses. */
export const resolverRespuesta = (spec, respuesta) =>
  respuesta?.$ref ? spec.components.responses[respuesta.$ref.split("/").pop()] : respuesta;

const respuestasExitosas = (spec) => [
  ...new Set(
    Object.values(spec.paths).flatMap((operaciones) =>
      Object.values(operaciones).flatMap((operacion) =>
        Object.entries(operacion.responses ?? {})
          .filter(([codigo]) => codigo.startsWith("2"))
          .flatMap(([, respuesta]) => Object.values(resolverRespuesta(spec, respuesta)?.content ?? {}))
      )
    )
  ),
];

/**
 * Convención de la documentación: en las respuestas exitosas, todo campo documentado
 * viene siempre (con `null` si no tiene valor) y queda en `required`. Un campo que puede
 * faltar se marca en su YAML con `x-opcional: true`. Así los tipos generados desde
 * /docs.json (panel y app) no quedan con todo opcional.
 *
 * - Solo se recorren las respuestas 2xx: los esquemas de los request bodies conservan su
 *   propio `required`. Si un esquema se usa en los dos lados (NegocioInput dentro de
 *   Negocio), la respuesta recibe una copia marcada y el body queda igual.
 * - Un objeto que ya declara `required` se respeta tal cual.
 * - tests/helpers/contrato.js comprueba en cada test que la API cumple lo marcado.
 */
export const marcarRequeridos = (spec) => {
  const esquemas = spec.components.schemas;

  const deEntrada = new Set();
  const pendientes = Object.values(spec.paths).flatMap((ops) =>
    Object.values(ops).flatMap((op) => [...referencias(op.requestBody)])
  );
  while (pendientes.length > 0) {
    const nombre = pendientes.pop();
    if (deEntrada.has(nombre)) continue;
    deEntrada.add(nombre);
    pendientes.push(...referencias(esquemas[nombre]));
  }

  const marcados = new Set();
  const marcar = (esquema) => {
    if (!esquema || typeof esquema !== "object") return esquema;
    if (esquema.$ref) {
      const nombre = esquema.$ref.split("/").pop();
      if (deEntrada.has(nombre)) return marcar(structuredClone(esquemas[nombre]));
      if (!marcados.has(nombre)) {
        marcados.add(nombre);
        esquemas[nombre] = marcar(esquemas[nombre]);
      }
      return esquema;
    }
    for (const clave of ["allOf", "oneOf", "anyOf"]) {
      if (esquema[clave]) esquema[clave] = esquema[clave].map(marcar);
    }
    if (esquema.items) esquema.items = marcar(esquema.items);
    if (esquema.additionalProperties && typeof esquema.additionalProperties === "object") {
      esquema.additionalProperties = marcar(esquema.additionalProperties);
    }
    if (esquema.properties) {
      // Antes de recorrer: una propiedad $ref puede volver como copia, sin su `x-opcional`.
      const requeridos = Object.entries(esquema.properties)
        .filter(([, propiedad]) => !propiedad["x-opcional"])
        .map(([campo]) => campo);
      for (const [campo, propiedad] of Object.entries(esquema.properties)) {
        esquema.properties[campo] = marcar(propiedad);
      }
      if (!esquema.required && requeridos.length > 0) esquema.required = requeridos;
    }
    return esquema;
  };

  for (const contenido of respuestasExitosas(spec)) contenido.schema = marcar(contenido.schema);
  return spec;
};

marcarRequeridos(swaggerSpec);

export default swaggerSpec;
