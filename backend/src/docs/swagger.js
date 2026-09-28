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

export default swaggerSpec;
