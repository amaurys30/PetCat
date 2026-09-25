# PetCat API — Plan de trabajo

Marca `[x]` al terminar cada tarea. Las convenciones están en `CLAUDE.md`.

## Estado al iniciar (septiembre 2026)

Backend en JavaScript ESM + mysql2 con 7 módulos: auth, negocios, sucursales, horarios, roles, empleados, invitaciones. Esquema MySQL completo en `petcat.sql` (34 tablas, triggers, vistas y seed de planes, roles, categorías y configuración). No existen aún módulos de mascotas, citas ni los demás.

---

## Fase 0 — Cimientos

Objetivo: que todo módulo nuevo nazca con el mismo patrón y que los módulos existentes queden corregidos y normalizados. Se puede hacer en tres bloques (0.A, 0.B, 0.C), cada uno con sus commits.

### 0.A Proyecto y configuración
- [x] Inicializar Git (si no existe), crear rama `fase-0`. Verificar que `.env` y `node_modules` están en `.gitignore`.
- [x] Mover `petcat.sql` a `database/petcat.sql` y actualizar la ruta en `docker-compose.yml`. Crear `database/migrations/` y `database/seeds/`.
- [x] `docker-compose.yml`: sacar la contraseña de root a variables de entorno (archivo `.env` en la raíz o `env_file`), sin valores fijos en el YAML.
- [x] Crear `backend/.env.example` con todas las variables: `NODE_ENV, PORT, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, JWT_EXPIRES_IN, REFRESH_SECRET, REFRESH_EXPIRES_IN, APP_URL, FRONTEND_URL, CORS_ORIGINS, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM`.
- [x] `src/config/env.js`: cargar y validar variables con Zod. Si falta una obligatoria (p. ej. `JWT_SECRET`), el servidor no arranca. Eliminar todos los secretos por defecto del código (`"petcat_secret_key"`, `"petcat_refresh_secret"`, contraseña `"2003"`).
- [x] `server.js`: `import "dotenv/config"` como **primera línea** (hoy `dotenv.config()` corre después de los imports y `jwt.js` firma con el secreto por defecto). `PORT` desde env. Quitar `dotenv.config()` de `app.js`.
- [x] `config/db.js`: usar `env.js`, `dateStrings: true`, `timezone: "-05:00"`, `charset: "utf8mb4"`. Exportar también `getConnection` para transacciones.
- [x] Dependencias: quitar `bcrypt` (dejar `bcryptjs`); agregar `zod, helmet, cors, express-rate-limit, morgan, nodemailer`; dev: `nodemon, vitest, supertest`. Scripts: `dev`, `start`, `test`.
- [x] Unificar `JWT_EXPIRES` → `JWT_EXPIRES_IN` (hoy el `.env` y el código usan nombres distintos).

### 0.B Infraestructura compartida
- [x] `shared/errors/ApiError.js` con estáticos: `badRequest, unauthorized, forbidden, notFound, conflict, unprocessable, tooMany, internal`.
- [x] `shared/middlewares/errorHandler.js` y `notFound.js` (ver reglas en `CLAUDE.md`).
- [ ] `shared/middlewares/validate.js`: valida `{ body, params, query }` con Zod, reemplaza por los datos parseados y responde 422 con `errors` por campo.
- [x] `shared/utils/response.js`: `ok(res, data, message)`, `created(res, data, message)`, `paginated(res, rows, meta)`.
- [ ] `shared/utils/pagination.js`: lee `page` y `limit` (por defecto 20, máximo 100), devuelve `{ limit, offset }` y construye `meta`.
- [ ] `shared/utils/transaction.js`: `withTransaction(async (conn) => {...})` con commit/rollback y liberación de la conexión. Los repositorios aceptan un `conn` opcional (`conn ?? pool`).
- [ ] `shared/utils/pick.js` (lista blanca de campos) y `sanitizeUsuario`.
- [ ] `shared/utils/mailer.js`: Nodemailer; en desarrollo, si no hay SMTP, registrar el correo y el enlace en consola.
- [ ] `app.js`: helmet, cors con `CORS_ORIGINS`, `express.json({ limit: "1mb" })`, morgan en desarrollo, rate limit general y uno más estricto para `/auth/login`, `/auth/forgot-password` e invitaciones. Montar todo bajo `/api/v1`. Swagger en `/api/v1/docs` con `servers.url` actualizado. `notFound` y `errorHandler` al final.

### 0.C Corrección y normalización de módulos existentes
Pasar cada módulo al patrón (schemas Zod, sin try/catch en controladores, `ApiError`, helpers de respuesta, Swagger actualizado).

**Bugs y riesgos a corregir**
- [ ] Eliminar `src/routes/users.routes.js`: `GET /usuarios` es público y devuelve `password_hash`; `POST /usuarios` recibe el hash directo.
- [ ] Eliminar `shared/middlewares/role.middleware.js` (duplica `authorize` y no se usa). Eliminar o completar `auth.validation.js` y `session.service.js` (están vacíos).
- [ ] `empleado.service.js`: falta importar `hasPermission` (lanza `ReferenceError` cuando edita alguien que no es propietario). Además, esa verificación duplica la de `authorize`: quitarla.
- [ ] `empleado.repository.js → update`: arma nombres de columna desde `req.body` (inyección SQL y asignación masiva de `id_negocio`, `id_usuario`, etc.). Usar lista blanca.
- [ ] `authorize`: rechazar empleados con `activo = FALSE`; resolver el negocio también desde `:id_cita`, `:id_servicio`, `:id_rol`... mediante un mapa de resolvers para no repetir código.
- [ ] `authMiddleware`: usar `verifyToken` de `utils/jwt.js`, validar el formato `Bearer`, comprobar `sesiones.expira_en` y que el usuario siga `activo`. Quitar la carga de permisos por `tipo_usuario === "negocio"` (toma el primer negocio encontrado; los permisos se resuelven por negocio en `authorize`).
- [ ] Login: mismo mensaje para email inexistente y contraseña errónea ("Credenciales inválidas"); rechazar usuarios inactivos o bloqueados; registrar `ip_address` y `user_agent` reales; actualizar `ultimo_acceso`.
- [ ] Logout: no fallar si el header viene mal formado.
- [ ] Registro: validar con Zod; no permitir `tipo_usuario = "admin"` desde el endpoint público.

**Rutas normalizadas**
- [ ] Negocios: `POST /negocios`, `GET /negocios/mios`, `GET /negocios/:id_negocio` (perfil público), `PATCH /negocios/:id_negocio`. Al crear un negocio, crear en la misma transacción una suscripción al plan Gratuito.
- [ ] Sucursales: `GET|POST /negocios/:id_negocio/sucursales`, `GET|PATCH|DELETE /sucursales/:id_sucursal`.
- [ ] Horarios: `GET /sucursales/:id_sucursal/horarios`, `PUT /sucursales/:id_sucursal/horarios` (reemplaza la semana completa, en transacción).
- [ ] Roles: `GET /negocios/:id_negocio/roles` (globales + propios), `POST /negocios/:id_negocio/roles`, `PATCH|DELETE /roles/:id_rol`. Los roles `es_sistema` no se editan ni se borran. Validar que `permisos_json` solo use módulos y acciones conocidos.
- [ ] Empleados: `GET|POST /negocios/:id_negocio/empleados`, `GET|PATCH|DELETE /empleados/:id_empleado`, `PATCH /empleados/:id_empleado/reactivar`. Validar que el `id_rol` asignado sea global o del mismo negocio.

**Flujo de invitaciones completo**
- [ ] `POST /empleados/:id_empleado/invitacion` — enviar. `id_negocio` se toma del empleado (hoy viene del query sin validar). Rechazar si el empleado no tiene email, está inactivo o ya tiene `id_usuario`.
- [ ] `POST /empleados/:id_empleado/invitacion/reenviar` — invalida las anteriores y crea una nueva; máximo 3 reenvíos usando `intentos_reenvio` (409 al superar el límite).
- [ ] `GET /invitaciones/:token` — público. Valida el token y devuelve negocio, rol, nombre del empleado y si el email **ya tiene cuenta**, para que el frontend decida si pedir contraseña o solo confirmar.
- [ ] `POST /invitaciones/:token/aceptar` — público. En **transacción**: crea el usuario o vincula el existente, asigna `empleados.id_usuario`, marca `usado` y `fecha_usado`. Si la cuenta ya existía, exigir su contraseña actual para vincular. Responde con access token, refresh token y sesión creada (auto-login), reutilizando la función de creación de sesión del login.
- [ ] Guardar en BD el **hash SHA-256** del token, no el token en claro. El enlace del correo lleva el token real: `${FRONTEND_URL}/invitacion/<token>`.
- [ ] Enviar el correo con `mailer.js`. No devolver el token en la respuesta de la API.

**Base de datos, datos de prueba y tests**
- [ ] Migración `001_empleados_email_por_negocio.sql`: `UNIQUE(id_negocio, email)` en `empleados`. Actualizar `petcat.sql`.
- [ ] `database/seeds/dev_seed.sql`: admin de plataforma, un propietario con negocio (plan Gratuito), una sucursal con horarios, dos empleados (veterinario vinculado y recepcionista con invitación pendiente), un cliente con dos mascotas y algunos servicios. Contraseña común documentada (p. ej. `Petcat123!`).
- [ ] Configurar Vitest + supertest con base `petcat_test`. Tests: health, registro, login, ruta protegida sin token (401), permisos (403), flujo completo de invitación (usuario nuevo y usuario existente).
- [ ] `backend/README.md`: cómo levantar el proyecto, aplicar migraciones, cargar el seed y correr los tests.

**Cierre de fase:** todos los tests pasan, Swagger muestra todos los endpoints actuales y el servidor arranca desde cero con `docker compose up` + seed.

---

## Fase 1 — Flujo principal: el dueño agenda y el veterinario atiende

**Auth completo**
- [ ] `POST /auth/refresh-token` (rota el refresh token), `GET /auth/me` (perfil + negocios a los que tiene acceso con su rol), `PATCH /auth/me`, `POST /auth/change-password` (cierra las demás sesiones), `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/verify-email/:token`.

**Mascotas (app)**
- [ ] `GET|POST /mascotas` (del usuario autenticado), `GET|PATCH|DELETE /mascotas/:id_mascota`, `GET /mascotas/:id_mascota/resumen-salud` (vacunas próximas o vencidas, último control, próximo control).

**Historial médico y vacunas**
- [ ] `GET /mascotas/:id_mascota/historial` (dueño o negocio con cita previa).
- [ ] `POST /negocios/:id_negocio/historial` (veterinario, opcionalmente ligado a `id_cita`), `PATCH /historial/:id_historial`.
- [ ] `GET /mascotas/:id_mascota/vacunas`; `POST /mascotas/:id_mascota/vacunas` (dueño registra una vacuna externa con comprobante) y `POST /negocios/:id_negocio/vacunas` (veterinario); `PATCH /vacunas/:id_vacuna`. Calcular `estado` según `fecha_proxima`.

**Catálogo y servicios**
- [ ] `GET /categorias-servicio`.
- [ ] `GET|POST /negocios/:id_negocio/servicios`, `GET|PATCH|DELETE /servicios/:id_servicio`.
- [ ] Públicos para la app: `GET /negocios` (buscar por `q`, `tipo`, `lat`/`lng`/`radio_km`, paginado) y `GET /servicios` (búsqueda por texto, categoría y especie).

**Disponibilidad**
- [ ] `GET|POST /empleados/:id_empleado/disponibilidad`, `PATCH|DELETE /disponibilidad/:id_disponibilidad` (horario normal, bloqueos, vacaciones).

**Citas**
- [ ] `GET /citas/horarios-libres?id_servicio&id_sucursal&fecha[&id_empleado]`: cruza horario de sucursal, disponibilidad del empleado, bloqueos, citas existentes, duración del servicio y `max_citas_dia`.
- [ ] `POST /citas` (dueño desde la app; valida que la mascota sea suya y compatible con el servicio) y `POST /negocios/:id_negocio/citas` (panel; origen presencial o teléfono).
- [ ] Evitar dobles reservas: transacción con `SELECT ... FOR UPDATE` sobre las citas del empleado ese día; 409 si el horario ya se ocupó.
- [ ] `GET /citas/mias` (dueño), `GET /negocios/:id_negocio/citas` (agenda con filtros de fechas, estado, empleado y sucursal), `GET /citas/:id_cita`.
- [ ] Máquina de estados: pendiente → confirmada | cancelada; confirmada → en_curso | cancelada | no_asistio; en_curso → completada. `PATCH /citas/:id_cita/estado`, `POST /citas/:id_cita/cancelar` (con motivo), `POST /citas/:id_cita/reprogramar` (crea una cita nueva con `id_cita_origen` y marca la original como `reprogramada`).
- [ ] Registrar cada cambio en `historial_citas`; `GET /citas/:id_cita/historial`.
- [ ] Al completar una cita, incrementar `negocios.total_citas`.

**Clientes (panel)**
- [ ] `GET /negocios/:id_negocio/clientes` y `GET /negocios/:id_negocio/clientes/:id_usuario` (datos de contacto, mascotas y citas con ese negocio).

---

## Fase 2 — Lo que hace viable el negocio
- [ ] Planes y suscripciones: `GET /planes`, `GET /negocios/:id_negocio/suscripcion`, cambio de plan y prueba Pro de 14 días. Middleware `checkPlanLimit` para sucursales, empleados, citas del mes y productos.
- [ ] Uploads con Cloudinary: fotos de mascotas, logos, banners, comprobantes y archivos del historial.
- [ ] Notificaciones: `GET /notificaciones`, marcar como leída, Socket.IO para el panel y Expo Push para la app (registro del token del dispositivo).
- [ ] Recordatorios: jobs con node-cron para citas, vacunas próximas o vencidas y limpieza de sesiones expiradas.
- [ ] Reseñas: el dueño reseña una cita completada (una por cita); el negocio responde; reportar reseña.
- [ ] Dashboard del panel: citas del día, ingresos, servicios más pedidos, clientes nuevos (usando las vistas SQL).

## Fase 3 — Inventario, compras y pagos
- [ ] Productos y categorías; movimientos de inventario (el trigger actualiza el stock); alertas de stock bajo y de vencimiento.
- [ ] Compras desde la app (carrito → pedido) y gestión de pedidos en el panel.
- [ ] Pagos con MercadoPago (preferencia de pago + webhook) para citas, compras y suscripciones; comisión del 4 %.

## Fase 4 — Diferenciadores
- [ ] Comunidad: posts, comentarios anidados, likes.
- [ ] Recomendaciones IA con gpt-4o-mini (según especie, edad, vacunas e historial).
- [ ] Panel de super admin: verificar y destacar negocios, configuración global, auditoría.

---

## Decisiones
- JavaScript ESM + mysql2, sin Prisma (columnas `SET`, triggers y vistas) y sin Redis en el MVP.
- Respuestas `{ success, message, data, meta }`; prefijo `/api/v1`.
- Acceso al panel por pertenencia (propietario o empleado activo), no por `tipo_usuario`.
- Email de empleado único por negocio.
- Un negocio ve el historial de una mascota solo si tiene al menos una cita con ella.
- Tokens de invitación guardados como hash SHA-256.
- MercadoPago como única pasarela del MVP; Expo Push en lugar de FCM directo.
- Variables de entorno: `src/config/env.js` valida pero no carga archivos. `server.js` carga `backend/.env`; Vitest inyecta `backend/.env.test` desde `vitest.config.js` (los tests importan `app.js` sin `server.js`). Con `NODE_ENV=test`, `DB_NAME` debe terminar en `_test`.
- Zona horaria: MySQL (contenedor con `TZ`) y el proceso Node (`env.js` fija `process.env.TZ`) usan `America/Bogota`, para que las fechas en texto (`dateStrings`) se interpreten igual en cualquier máquina.
- Node 24 LTS (imagen `node:24`, `engines >=24`). Node 20 terminó su soporte en abril de 2026.
- MySQL de docker compose publicado solo en `127.0.0.1:3307`.
