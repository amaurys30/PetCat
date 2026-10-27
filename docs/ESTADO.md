# PetCat · Estado del proyecto (octubre 2026)

Resumen para el equipo al cerrar el **panel web v1** (fase P7). El detalle de cada tarea está en `docs/PLAN.md` (API) y `frontend/web/PLAN.md` (panel); cómo levantar y extender el panel, en `frontend/web/README.md`.

## En una línea

La API cubre las Fases 0 a 2 (flujo de citas completo, salud, notificaciones, planes, reseñas, dashboard) y el panel web v1 implementa todas sus pantallas del Figma conectadas a esa API, probadas de punta a punta contra la base de demo. Falta lo de la Fase 3 (inventario, pedidos y pagos), la Fase 4 (comunidad, IA) y los requisitos legales y de infraestructura antes de abrir a usuarios reales.

---

## 1. Qué cubre el panel v1

| Área | Pantallas | Qué se puede hacer |
|---|---|---|
| Acceso | A1–A9 | Iniciar sesión, recuperar y crear contraseña, crear cuenta y verificar el correo, aceptar invitaciones (cuenta nueva o existente), elegir negocio, crear negocio en tres pasos (datos, sede con mapa, horarios), aceptar la política de datos. Sesión compartida entre pestañas. |
| Dashboard | B1, B2 | Indicadores, tendencia, comparación y desempeño por profesional; secciones avanzadas bloqueadas en el plan Gratuito. |
| Agenda | B3–B10 | Semana, Día por profesional y Lista; "Por confirmar" y "Fuera de disponibilidad"; detalle lateral con historial y cumplimiento del cliente; confirmar, rechazar, cancelar, reprogramar, reasignar, iniciar, completar y no asistió; nueva cita con búsqueda de cliente, registro de cliente sin app y horarios libres; actualización en tiempo real. Sin `citas.ver_todas`, cada profesional ve y gestiona solo sus citas. |
| Clientes y salud | C1–C6 | Lista y detalle de clientes (cumplimiento, notas privadas, correo de un cliente sin cuenta), ficha de la mascota (resumen de salud, historial compartido o propio, carnet), registro médico con archivos privados y rastro de ediciones, vacunas con comprobante, mascotas nuevas. Búsqueda en el Topbar. |
| Servicios y equipo | D1–D6 | Catálogo y formulario de servicios (especies, precios, oferta, profesionales, indicaciones); miembros, invitaciones, roles y permisos con la regla de escalada; disponibilidad semanal y excepciones con las citas afectadas. |
| Negocio | E0–E6 | Perfil y configuración (logo, banner, confirmación automática), sedes y horarios, reseñas (responder, reportar), suscripción y prueba Pro, notificaciones (campana, tiempo real, avisos del navegador), mi perfil. |
| Plataforma | X1 | Super admin: negocios con plan y estado efectivos, asignar planes con el historial de quién los asignó. |
| Estados | S1 / F | Carga, vacío, error, sin permiso, no encontrado, sin conexión, sesión vencida y límite del plan en cada pantalla. |

**Calidad:** pruebas de componentes con la API simulada, flujos de punta a punta con Playwright contra la API de demo (incluidos los recorridos completos de P7 y una revisión de accesibilidad con axe por pantalla principal), typecheck, lint y build en CI. La API tiene su suite de integración con verificación del contrato de Swagger.

**Fuera del panel v1:** inventario, pedidos y pagos (las secciones del menú muestran "Próximamente"), estadísticas avanzadas de reportes, WhatsApp, IA, y el panel para el diseño móvil (el panel es de escritorio, desde 1280 px).

---

## 2. Pendientes de API, por prioridad

Lo que el panel necesita y la API todavía no tiene (lista completa con el contexto en `frontend/web/PLAN.md`, "Pendientes de API"). Hoy el panel funciona con una solución intermedia en cada caso.

### Alta: pueden causar errores o pérdida de datos

| Pendiente | Riesgo hoy | Propuesta |
|---|---|---|
| Cambios simultáneos en los profesionales de un servicio (D2, D3b) | `empleados` en `PATCH /servicios/:id` (y `servicios` en `PATCH /empleados/:id`) reemplaza el conjunto: si dos personas editan a la vez, la última deshace la asignación de la otra sin aviso. | Control de versión (`fecha_actualizacion` → 409) o cambios parciales (`empleados_agregar` / `empleados_quitar`). |
| Simular `citas_afectadas` antes de guardar (E2, D5, D6) | El aviso "2 citas quedarán fuera" llega después de guardar, cuando el horario ya cambió. | `?simular=true` en horarios y disponibilidad, o consultar después las citas fuera de disponibilidad. |

### Media: experiencia de uso o rendimiento

| Pendiente | Hoy | Propuesta |
|---|---|---|
| Mascotas con vacunas vencidas (B1) | El dashboard da solo el número, sin enlace a cuáles. | `GET /negocios/:id/mascotas/vacunas-vencidas?dias=30`. |
| Disponibilidad efectiva en lote (B9) | La vista Día hace 2 consultas por profesional. | `GET /negocios/:id/disponibilidad-efectiva?fecha&id_sucursal`. |
| `GET /invitaciones/mias` | Quien espera una invitación no la ve en `/bienvenida` sin abrir el correo. | Listar las invitaciones pendientes del usuario. |
| Bienvenida de un cliente registrado por un negocio (A3) | Texto genérico y, al guardar, ir al login. | Devolver el negocio con el token y la sesión al restablecer. |
| Motivo del 401 | El login no puede decir por qué se cerró la sesión. | `errors.motivo` (`password_cambiada`, `sesion_revocada`…). |
| Archivos y catálogos de salud (C2, C5) | Sin `GET /historial/:id`, sin vista de todos los archivos de la mascota y sugerencias de vacunas fijas por especie. | Esos tres endpoints. |
| Vacuna "verificada" por un negocio | Una vacuna del dueño solo la edita el dueño. | Decidir el diseño antes de construirlo (ver PLAN del panel). |

### Baja: detalles de diseño

- Redes sociales del negocio (E1): el mockup muestra Instagram; hoy solo hay sitio web.
- Conteos del catálogo en `meta.resumen` (D1): hoy el panel pide todo el catálogo de 100 en 100.
- Precio "Desde" y duración "Todo el día" (D1, D2): hoy se muestran a partir de `variable` sin máximo y 1440 minutos.
- La búsqueda del Topbar no busca citas.

---

## 3. Requisitos antes de lanzar con usuarios reales

| Requisito | Estado | Qué falta |
|---|---|---|
| Supresión y consulta de datos (Ley 1581 de 2012) | Pendiente | Supresión de la cuenta y sus datos con borrado físico de archivos en Cloudinary, revocación de la autorización, exportar lo que un negocio guarda sobre el titular (incluidas las notas de clientes). Hoy el borrado es lógico. |
| Contacto de soporte real | Pendiente | `soporte_email` y `soporte_whatsapp` en `configuracion_global`. |
| Correo real | Pendiente | Proveedor transaccional con dominio verificado (SPF, DKIM, DMARC) y las variables SMTP en el servidor. En desarrollo va a Mailpit. |
| Google Maps en el panel | Pendiente | Facturación de Google Cloud, clave restringida al dominio y a Maps JavaScript y Places, alerta de presupuesto, y la clave en el build. Mientras tanto, coordenadas manuales. |
| Seguridad de las cuentas de super admin | Pendiente | Verificación en dos pasos y sesión más corta para `tipo_usuario = admin`. |
| Sesión del panel | Deuda aceptada en el MVP | El refresh token está en `localStorage`; a futuro, cookie httpOnly desde la API. |
| Pagos | Fase 3 | MercadoPago (citas, pedidos y suscripciones, comisión del 4 %). Hoy los planes los asigna el super admin a mano. |
| Despliegue | Pendiente | Servidor para la API y MySQL, dominio y HTTPS, el panel como sitio estático, copias de seguridad de la base. |
| Pruebas de punta a punta en CI | Pendiente | Hoy corren en el equipo de desarrollo contra la demo; en CI necesitan la API con un MySQL de servicio. |

---

## 4. Lo que sigue

1. **Fase 3** de la API (inventario, pedidos, MercadoPago) y su parte del panel.
2. Los pendientes de API de prioridad alta.
3. La app móvil (Daniel) sobre la misma API: el contrato está en Swagger.
4. Los requisitos de lanzamiento de la sección 3, empezando por la Ley 1581, el correo real y el despliegue.
