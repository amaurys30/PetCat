import express from "express";
import * as controller from "./salud.controller.js";
import { idMascotaParams } from "../mascotas/mascota.schemas.js";
import { mascotaDeNegocioParams } from "../historial/historial.schemas.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
import { authorizeAny } from "../../shared/middlewares/authorize.middleware.js";
import { validate } from "../../shared/middlewares/validate.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     VacunaAlerta:
 *       type: object
 *       properties:
 *         id_vacuna: { type: integer }
 *         nombre_vacuna: { type: string }
 *         fecha_aplicacion: { type: string, format: date }
 *         fecha_proxima: { type: string, format: date }
 *         registrada_por: { type: string, enum: [dueno, negocio] }
 *         dias_vencida: { type: integer, x-opcional: true, description: Solo en vencidas }
 *         dias_restantes: { type: integer, x-opcional: true, description: Solo en próximas }
 *     ResumenSalud:
 *       type: object
 *       properties:
 *         mascota:
 *           allOf:
 *             - $ref: '#/components/schemas/Mascota'
 *           description: >
 *             La mascota completa (cabecera de la ficha), con `compartir_historial`. Alergias y condiciones
 *             médicas siempre visibles.
 *         dueno:
 *           type: object
 *           description: Dueño de la mascota
 *           properties:
 *             id_usuario: { type: integer }
 *             nombre: { type: string }
 *             apellido: { type: string }
 *         vacunas_vencidas:
 *           type: array
 *           description: Dosis vigentes con fecha_proxima anterior a hoy, de la más vencida a la menos
 *           items: { $ref: '#/components/schemas/VacunaAlerta' }
 *         vacunas_proximas:
 *           type: array
 *           description: Dosis vigentes con fecha_proxima entre hoy y hoy + 30 días (dias_aviso_vacuna)
 *           items: { $ref: '#/components/schemas/VacunaAlerta' }
 *         ultimo_control:
 *           type: object
 *           nullable: true
 *           description: >
 *             Registro de historial más reciente (fuente historial: id_historial, tipo y diagnóstico) o, si no
 *             hay, la última cita completada (fuente cita: id_cita, hora, estado y servicio).
 *           properties:
 *             fuente: { type: string, enum: [historial, cita] }
 *             fecha: { type: string, format: date }
 *             negocio:
 *               type: object
 *               nullable: true
 *               properties: { id_negocio: { type: integer }, nombre: { type: string } }
 *             id_historial: { type: integer, x-opcional: true }
 *             tipo: { type: string, x-opcional: true }
 *             diagnostico: { type: string, nullable: true, x-opcional: true }
 *             id_cita: { type: integer, x-opcional: true }
 *             hora_inicio: { type: string, example: "08:00", x-opcional: true }
 *             estado: { type: string, x-opcional: true }
 *             servicio:
 *               type: object
 *               x-opcional: true
 *               properties: { id_servicio: { type: integer }, nombre: { type: string } }
 *         proximo_control:
 *           type: object
 *           nullable: true
 *           description: El proximo_control más cercano (hoy o después) que indicó un veterinario
 *           properties:
 *             fecha: { type: string, format: date }
 *             id_historial: { type: integer }
 *             negocio:
 *               type: object
 *               nullable: true
 *               properties: { id_negocio: { type: integer }, nombre: { type: string } }
 *         proxima_cita:
 *           type: object
 *           nullable: true
 *           description: La cita pendiente o confirmada más cercana que no terminó (para un negocio, solo las suyas)
 *           properties:
 *             id_cita: { type: integer }
 *             fecha: { type: string, format: date }
 *             hora_inicio: { type: string, example: "08:00" }
 *             estado: { type: string, enum: [pendiente, confirmada] }
 *             servicio:
 *               type: object
 *               properties: { id_servicio: { type: integer }, nombre: { type: string } }
 *             negocio:
 *               type: object
 *               properties: { id_negocio: { type: integer }, nombre: { type: string } }
 *         evolucion_peso:
 *           type: object
 *           properties:
 *             peso_actual: { type: number, nullable: true }
 *             puntos:
 *               type: array
 *               description: Pesos del historial de los últimos 24 meses (máximo 24), del más antiguo al más reciente
 *               items: { type: object, properties: { fecha: { type: string, format: date }, peso: { type: number } } }
 *             variacion_kg: { type: number, nullable: true, description: Entre los dos últimos puntos }
 *             variacion_pct: { type: number, nullable: true }
 *             tendencia: { type: string, enum: [sube, baja, estable], nullable: true, description: estable si cambia menos del 5 % }
 *     ResumenSaludRespuesta:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: OK }
 *         data: { $ref: '#/components/schemas/ResumenSalud' }
 */

/**
 * @swagger
 * /mascotas/{id_mascota}/resumen-salud:
 *   get:
 *     summary: Resumen de salud de una mascota propia (app)
 *     description: Con todo su historial y sus vacunas. Una mascota fallecida no trae alertas de vacunas ni próxima cita.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Resumen
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ResumenSaludRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/MascotaAjena' }
 *       404: { $ref: '#/components/responses/MascotaNoEncontrada' }
 */
router.get("/mascotas/:id_mascota/resumen-salud", authMiddleware, validate({ params: idMascotaParams }), controller.getResumenDueno);

/**
 * @swagger
 * /negocios/{id_negocio}/mascotas/{id_mascota}/resumen-salud:
 *   get:
 *     summary: Resumen de salud de una mascota (panel)
 *     description: >
 *       Requiere `historial_medico.ver` o `vacunas.ver` y una cita válida con la mascota. Las vacunas son
 *       todas; el historial (último y próximo control, peso) respeta `compartir_historial`; la próxima cita
 *       es solo de este negocio.
 *     tags: [Historial médico]
 *     parameters:
 *       - { in: path, name: id_negocio, required: true, schema: { type: integer } }
 *       - { in: path, name: id_mascota, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Resumen
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ResumenSaludRespuesta' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  "/negocios/:id_negocio/mascotas/:id_mascota/resumen-salud",
  authMiddleware,
  validate({ params: mascotaDeNegocioParams }),
  authorizeAny([
    ["historial_medico", "ver"],
    ["vacunas", "ver"],
  ]),
  controller.getResumenNegocio
);

export default router;
