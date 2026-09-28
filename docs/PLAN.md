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
- [x] `shared/middlewares/validate.js`: valida `{ body, params, query }` con Zod, reemplaza por los datos parseados y responde 422 con `errors` por campo.
- [x] `shared/utils/response.js`: `ok(res, data, message)`, `created(res, data, message)`, `paginated(res, rows, meta)`.
- [x] `shared/utils/pagination.js`: lee `page` y `limit` (por defecto 20, máximo 100), devuelve `{ limit, offset }` y construye `meta`.
- [x] `shared/utils/transaction.js`: `withTransaction(async (conn) => {...})` con commit/rollback y liberación de la conexión. Los repositorios aceptan un `conn` opcional (`conn ?? pool`).
- [x] `shared/utils/pick.js` (lista blanca de campos) y `sanitizeUsuario`.
- [x] `shared/utils/mailer.js`: Nodemailer; en desarrollo, si no hay SMTP, registrar el correo y el enlace en consola.
- [x] `app.js`: helmet, cors con `CORS_ORIGINS`, `express.json({ limit: "1mb" })`, morgan en desarrollo, rate limit general y uno más estricto para `/auth/login`, `/auth/forgot-password` e invitaciones. Montar todo bajo `/api/v1`. Swagger en `/api/v1/docs` con `servers.url` actualizado. `notFound` y `errorHandler` al final.

### 0.C Corrección y normalización de módulos existentes
Pasar cada módulo al patrón (schemas Zod, sin try/catch en controladores, `ApiError`, helpers de respuesta, Swagger actualizado). Cada módulo normalizado queda con tests de integración (caso feliz, 401, 403, 404 y 422).

Se hace en sub-bloques que se aprueban por separado: **0.C.1** base de tests y seed · **0.C.2** auth, authMiddleware y authorize · **0.C.3** negocios, sucursales, horarios y roles · **0.C.4** empleados · **0.C.5** invitaciones · **0.C.6** migraciones, README y cierre.

**Bugs y riesgos a corregir**
- [x] Eliminar `src/routes/users.routes.js`: `GET /usuarios` es público y devuelve `password_hash`; `POST /usuarios` recibe el hash directo.
- [x] Eliminar `shared/middlewares/role.middleware.js` (duplica `authorize` y no se usa). Eliminar o completar `auth.validation.js` y `session.service.js` (están vacíos).
- [x] `empleado.service.js`: falta importar `hasPermission` (lanza `ReferenceError` cuando edita alguien que no es propietario). Además, esa verificación duplica la de `authorize`: quitarla.
- [x] `empleado.repository.js → update`: arma nombres de columna desde `req.body` (inyección SQL y asignación masiva de `id_negocio`, `id_usuario`, etc.). Usar lista blanca.
- [x] `authorize`: rechazar empleados con `activo = FALSE`; resolver el negocio también desde `:id_cita`, `:id_servicio`, `:id_rol`... mediante un mapa de resolvers para no repetir código.
- [x] `authMiddleware`: usar `verifyToken` de `utils/jwt.js`, validar el formato `Bearer`, comprobar `sesiones.expira_en` y que el usuario siga `activo`. Quitar la carga de permisos por `tipo_usuario === "negocio"` (toma el primer negocio encontrado; los permisos se resuelven por negocio en `authorize`).
- [x] Login: mismo mensaje para email inexistente y contraseña errónea ("Credenciales inválidas"); rechazar usuarios inactivos o bloqueados; registrar `ip_address` y `user_agent` reales; actualizar `ultimo_acceso`.
- [x] Logout: no fallar si el header viene mal formado.
- [x] Registro: validar con Zod; no permitir `tipo_usuario = "admin"` desde el endpoint público.

**Rutas normalizadas**
- [x] Negocios: `POST /negocios`, `GET /negocios/mios`, `GET /negocios/:id_negocio` (perfil público), `PATCH /negocios/:id_negocio`. Al crear un negocio, crear en la misma transacción una suscripción al plan Gratuito.
- [x] Sucursales: `GET|POST /negocios/:id_negocio/sucursales`, `GET|PATCH|DELETE /sucursales/:id_sucursal`.
- [x] Horarios: `GET /sucursales/:id_sucursal/horarios`, `PUT /sucursales/:id_sucursal/horarios` (reemplaza la semana completa, en transacción). La semana llega como lista de rangos; se permiten varios rangos por día (horario partido) y el servicio valida que no se crucen.
- [x] Roles: `GET /negocios/:id_negocio/roles` (globales + propios), `POST /negocios/:id_negocio/roles`, `PATCH|DELETE /roles/:id_rol`. Los roles `es_sistema` no se editan ni se borran. Validar que `permisos_json` solo use módulos y acciones conocidos.
- [x] Empleados: `GET|POST /negocios/:id_negocio/empleados`, `GET|PATCH|DELETE /empleados/:id_empleado`, `PATCH /empleados/:id_empleado/reactivar`. Validar que el `id_rol` asignado sea global o del mismo negocio.

**Flujo de invitaciones completo**
- [x] `POST /empleados/:id_empleado/invitacion` — enviar. `id_negocio` se toma del empleado (hoy viene del query sin validar). Rechazar si el empleado no tiene email, está inactivo o ya tiene `id_usuario`.
- [x] `POST /empleados/:id_empleado/invitacion/reenviar` — invalida las anteriores y crea una nueva; máximo 4 correos al mismo email en 24 horas, contando el envío (409 al superar el límite; pasada la ventana se puede volver a invitar).
- [x] `GET /invitaciones/:token` — público. Valida el token y devuelve negocio, rol, nombre del empleado y si el email **ya tiene cuenta**, para que el frontend decida si pedir contraseña o solo confirmar.
- [x] `POST /invitaciones/:token/aceptar` — público. En **transacción**: crea el usuario o vincula el existente, asigna `empleados.id_usuario`, marca `usado` y `fecha_usado`. Si la cuenta ya existía, exigir su contraseña actual para vincular. Responde con access token, refresh token y sesión creada (auto-login), reutilizando la función de creación de sesión del login.
- [x] Guardar en BD el **hash SHA-256** del token, no el token en claro. El enlace del correo lleva el token real: `${FRONTEND_URL}/invitacion/<token>`.
- [x] Enviar el correo con `mailer.js`. No devolver el token en la respuesta de la API.
- [x] Propietario como empleado de su propio negocio, sin invitación (en veterinarias pequeñas el dueño es el veterinario y debe aparecer en la agenda). Implementado: `POST /negocios/:id_negocio/empleados/yo`, solo para el propietario: crea el empleado con `id_usuario` = su cuenta y nombre, apellido y email tomados de ella; el body lleva `id_rol` (por defecto Administrador) y los datos profesionales. Si ya existe un empleado sin cuenta con su email, lo vincula en lugar de crear otro; si ya está vinculado, 409 (lo garantiza también `UNIQUE(id_negocio, id_usuario)`). Es más explícito que vincular por email al crear un empleado, que mezclaría dos flujos en el mismo endpoint.

**Base de datos, datos de prueba y tests**
- [x] Migración `001_empleados_unicos_por_negocio.sql`: `UNIQUE(id_negocio, email)` y `UNIQUE(id_negocio, id_usuario)` en `empleados`. Actualizar `petcat.sql`. (Se aplica después de la 002 y la 003: son independientes.)
- [x] Migración `002_horarios_varios_rangos.sql`: quitar `UNIQUE(id_sucursal, dia_semana)` de `horarios_negocio` para permitir horario partido. Actualizar `petcat.sql`. (Creada en 0.C.3; Amaurys la aplica en su base.)
- [x] Migración `003_rol_administrador_permisos.sql`: el rol del sistema Administrador con el catálogo completo de permisos (le faltaban `historial_medico`, `vacunas`, `editar_stock` y `ver_basico`). Actualizar `petcat.sql`.
- [x] `database/seeds/dev_seed.sql`: admin de plataforma, un propietario con negocio (plan Gratuito), una sucursal con horarios, dos empleados (veterinario vinculado y recepcionista con invitación pendiente), un cliente con dos mascotas y algunos servicios. Contraseña común documentada (p. ej. `Petcat123!`).
- [x] Configurar Vitest + supertest con base `petcat_test`. Tests: health, registro, login, ruta protegida sin token (401), permisos (403), flujo completo de invitación (usuario nuevo y usuario existente).
- [x] `backend/README.md`: cómo levantar el proyecto, aplicar migraciones, cargar el seed y correr los tests. Incluye una sección para el panel web y la app móvil sobre cómo consumir la API.
- [x] `npm run db:migrate`: registra las migraciones aplicadas por **nombre de archivo** (tabla `schema_migrations`), no por el número más alto. En la base de Amaurys la 002 y la 003 se aplicaron antes que la 001: se marcan con `npm run db:migrate -- --baseline` (una sola vez). `--status` muestra el estado.
- [x] Quitar del `errorHandler` la compatibilidad temporal con `error.status`.
- [x] Workflow de GitHub Actions (`.github/workflows/tests.yml`): suite de tests con MySQL 8 de servicio en cada PR y push a `main`.

**Cierre de fase:** todos los tests pasan, Swagger muestra todos los endpoints actuales y el servidor arranca desde cero con `docker compose up` + seed.

- [x] Verificado el 26/09/2026 desde un clon limpio de `fase-0`, con un proyecto de compose aparte (otros nombres y puertos): MySQL y backend healthy, esquema y seed cargados con tildes correctas, login, perfil público, empleados, invitación enviada y aceptada, Swagger con 21 rutas y 31 operaciones sin referencias rotas, `db:migrate` al día. La suite (231 tests) pasa en el clon contra un MySQL 8 nuevo con los mismos pasos del workflow de CI. La verificación encontró que compose cargaba `petcat.sql` y el seed en latin1 (ver Decisiones).

---

## Fase 1 — Flujo principal: el dueño agenda y el veterinario atiende

Se hace en sub-bloques que se aprueban por separado: **1.1** auth completo · **1.2** mascotas · **1.3** catálogo, servicios y búsqueda pública · **1.4** disponibilidad de empleados · **1.5** citas · **1.6** historial médico, vacunas y resumen de salud · **1.7** clientes. Las decisiones están en "Decisiones de la Fase 1".

### 1.1 Auth completo
- [x] Migración `004_tokens_usuario_y_sesiones.sql`: vencimiento propio para el token de verificación y el de recuperación (hoy comparten `token_expiracion`) e índices para buscar por esos tokens y por `sesiones.refresh_token`.
- [x] Migración `005_disponibilidad_rangos.sql`: `fecha_fin` en `disponibilidad_empleado` (vacaciones de varios días) y llave foránea de `id_sucursal` (se usa en 1.4).
- [x] `POST /auth/refresh-token` (rota el refresh token; 30 días renovados en cada uso), `GET /auth/me` (perfil + negocios a los que tiene acceso con su rol), `PATCH /auth/me`, `POST /auth/change-password` (cierra las demás sesiones).
- [x] `POST /auth/forgot-password`, `POST /auth/reset-password`: funcionan aunque la cuenta esté bloqueada por intentos fallidos; al restablecer la contraseña se reinician `intentos_login` y `bloqueado_hasta`.
- [x] `GET /auth/verify-email/:token`; el registro envía el correo de verificación; `POST /auth/resend-verification`.

### 1.2 Mascotas (app)
- [x] `GET|POST /mascotas` (del usuario autenticado), `GET|PATCH|DELETE /mascotas/:id_mascota`.

### 1.3 Catálogo, servicios y búsqueda pública
- [x] Migración `006_servicios_empleados_y_margen.sql`: tabla `empleado_servicios (id_empleado, id_servicio)` y `servicios.margen_minutos` (por defecto 0).
- [x] `GET /categorias-servicio`.
- [x] `GET|POST /negocios/:id_negocio/servicios`, `GET|PATCH|DELETE /servicios/:id_servicio`, `PATCH /servicios/:id_servicio/reactivar`. El body de crear y editar acepta los empleados asignados; el listado del panel indica `sin_empleados`.
- [x] Públicos para la app: `GET /negocios` (buscar por `q`, `tipo`, `id_categoria`, `lat`/`lng`/`radio_km`, paginado) y `GET /servicios` (búsqueda por texto, categoría, especie, negocio, oferta y cercanía).

### 1.4 Disponibilidad
- [x] `authorizeAny`: acceso con cualquiera de varios permisos y una excepción opcional (el mismo empleado).
- [x] `GET /empleados/:id_empleado/disponibilidad` (horario semanal y excepciones), `PUT /empleados/:id_empleado/horario-semanal` (reemplaza el `horario_normal`), `POST /empleados/:id_empleado/disponibilidad` (bloqueo, vacación o evento especial), `PATCH|DELETE /disponibilidad/:id_disponibilidad`.
- [x] Cálculo de la disponibilidad efectiva (función pura que reutiliza 1.5) y `GET /empleados/:id_empleado/disponibilidad-efectiva?fecha[&id_sucursal]`.
- [x] `citas_afectadas` en las escrituras: citas futuras pendientes o confirmadas del empleado que no caben en su disponibilidad.

### 1.5 Citas

En tres partes: **1.5.1** horarios libres, reservas y clientes del panel · **1.5.2** consultas y agenda · **1.5.3** cambios sobre las citas.

- [x] Claves nuevas en `configuracion_global`: intervalo de la agenda, antelación mínima, horizonte máximo y antelación para cancelar o reprogramar desde la app.
- [x] `GET /citas/horarios-libres?id_servicio&id_sucursal&fecha[&id_empleado]`: cruza horario de sucursal, disponibilidad del empleado, bloqueos, citas existentes, duración y margen del servicio y `max_citas_dia` (reglas en Decisiones).
- [x] `POST /citas` (dueño desde la app; valida que la mascota sea suya y compatible con el servicio) y `POST /negocios/:id_negocio/citas` (panel; origen presencial o teléfono).
- [x] Panel: buscar un cliente por email o teléfono exactos (datos mínimos y mascotas activas) y registrar un cliente sin app con su mascota (email obligatorio).
- [x] Evitar dobles reservas: transacción que bloquea la fila del servicio (si tiene `max_citas_dia`) y la del empleado, siempre en ese orden; 409 si el horario ya se ocupó.
- [x] Migración `007_citas_configuracion_y_autorizaciones.sql`: claves de la agenda en `configuracion_global` y tabla `autorizaciones_datos`.
- [x] `POST /auth/register` exige `acepta_politica_datos: true` y guarda la autorización (canal app).
- [x] Panel: registrar otra mascota de un cliente con relación con el negocio (`POST /negocios/:id_negocio/clientes/:id_usuario/mascotas`).
- [x] `GET /citas/mias` (dueño), `GET /negocios/:id_negocio/citas` (agenda con filtros de fechas, estado, empleado y sucursal), `GET /citas/:id_cita` (dueño o negocio).
- [x] Máquina de estados: pendiente → confirmada | cancelada; confirmada → en_curso | cancelada | no_asistio; en_curso → completada. `PATCH /citas/:id_cita/estado`, `POST /citas/:id_cita/cancelar` (con motivo), `POST /citas/:id_cita/reprogramar` (crea una cita nueva con `id_cita_origen` y marca la original como `reprogramada`).
- [x] `PATCH /citas/:id_cita` (panel): `notas_internas`, `prioridad`, `precio_final` y reasignar el empleado.
- [x] Registrar cada cambio en `historial_citas`; `GET /citas/:id_cita/historial`.
- [x] Al completar una cita, incrementar `negocios.total_citas`.
- [x] Migración `009_citas_cancelacion_e_inasistencias.sql`: `cancelada_por`, `fecha_cancelacion`, `cancelacion_tardia` e índice para contar inasistencias por cliente y negocio.
- [x] `citas_afectadas` al cambiar el horario de una sucursal (`PUT /sucursales/:id_sucursal/horarios`) y al desactivar un empleado (`DELETE /empleados/:id_empleado`).

### 1.6 Historial médico, vacunas y resumen de salud
- [x] Migración `010_historial_vacunas_y_privacidad.sql`: `mascotas.compartir_historial`, `vacunas.registrada_por` e `id_usuario_registro`, llave foránea de `historial_medico.id_cita` y `dias_aviso_vacuna` en `configuracion_global`.
- [x] Dueño: `GET /mascotas/:id_mascota/historial`, `GET|POST /mascotas/:id_mascota/vacunas` (vacuna externa, marcada como del dueño, con comprobante opcional), `GET /mascotas/:id_mascota/resumen-salud` y `compartir_historial` en `PATCH /mascotas/:id_mascota`.
- [x] Panel (negocio con cita válida): `GET /negocios/:id_negocio/mascotas/:id_mascota/historial`, `/vacunas` y `/resumen-salud`; `POST /negocios/:id_negocio/historial` (opcionalmente ligado a `id_cita`), `PATCH /historial/:id_historial`, `POST /negocios/:id_negocio/vacunas`.
- [x] `PATCH /vacunas/:id_vacuna` (la del dueño la edita el dueño; la de un negocio, ese negocio). Estado según `fecha_proxima`, con las dosis anteriores de la misma vacuna en `no_aplica`.

### 1.7 Clientes (panel)
- [ ] `GET /negocios/:id_negocio/clientes` y `GET /negocios/:id_negocio/clientes/:id_usuario` (datos de contacto, mascotas y citas con ese negocio).

---

## Fase 2 — Lo que hace viable el negocio
- [ ] Planes y suscripciones: `GET /planes`, `GET /negocios/:id_negocio/suscripcion`, cambio de plan y prueba Pro de 14 días. Middleware `checkPlanLimit` para sucursales, empleados, citas del mes y productos.
- [ ] Uploads con Cloudinary: fotos de mascotas, logos, banners, comprobantes y archivos del historial.
- [ ] Notificaciones: `GET /notificaciones`, marcar como leída, Socket.IO para el panel y Expo Push para la app (registro del token del dispositivo).
- [ ] Recordatorios: jobs con node-cron para citas, vacunas próximas o vencidas y limpieza de sesiones expiradas. El mismo cron refresca `vacunas.estado`.
- [ ] Citas pendientes sin confirmar: cancelación automática (plazo por definir).
- [ ] Opción por negocio para confirmar automáticamente las citas que llegan desde la app.
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
- Límites de solicitudes: 300 cada 15 min por IP en toda la API; estricto (`AUTH_RATE_LIMIT_MAX`, por defecto 10 en producción y 100 en desarrollo) con un contador propio por endpoint en login, forgot-password e invitaciones. Desactivados con `NODE_ENV=test`.
- `GET /api/v1/health` comprueba la base (`SELECT 1`, 503 si no responde); lo usa el healthcheck del backend en compose. Health y Swagger quedan fuera del rate limit.
- Swagger: `servers` relativo (`/api/v1`) para que "Try it out" funcione desde cualquier host; especificación en `/api/v1/docs.json`.

### Decisiones de 0.C (septiembre 2026)
- Base de tests: `petcat_test` se borra y recrea en cada corrida cargando `database/petcat.sql` con un cargador en Node (entiende `DELIMITER`). Cada test crea sus propios datos con emails únicos; no se limpia entre tests. El seed de desarrollo también se carga y se prueba en `petcat_test`.
- Seed: `database/seeds/dev_seed.sql`, contraseña común `Petcat123!`. En volúmenes nuevos compose lo ejecuta después del esquema (`01_petcat.sql`, `02_dev_seed.sql`). `npm run db:reset -- --yes` recrea `petcat_db` con esquema y seed (se niega en producción y sin `--yes`).
- Sesiones: se guarda el hash SHA-256 del access token y del refresh token, no los tokens en claro. La sesión dura lo mismo que el refresh token.
- Login: 5 intentos fallidos seguidos bloquean la cuenta 15 minutos (`intentos_login`, `bloqueado_hasta`). Un login correcto reinicia el contador. Mismo mensaje "Credenciales inválidas" si el email no existe o la contraseña es errónea (con comparación contra un hash ficticio para no delatar emails). Cuenta inactiva o bloqueada: 403.
- Respuesta del login y de aceptar invitación: `data: { access_token, refresh_token, usuario }` (snake_case, como el resto de campos).
- `GET /negocios/mios` devuelve los negocios propios y aquellos donde el usuario es empleado activo, con `relacion: "propietario" | "empleado"` y su rol.
- Sin escalada de privilegios: quien no es propietario no puede crear ni editar un rol con permisos que él no tiene, ni asignar ese rol, ni cambiar su propio rol (403).
- Invitaciones: vigencia de 72 horas. Al aceptar, un usuario nuevo queda con `email_verificado = TRUE` (abrir el enlace prueba que el correo es suyo).
- Suscripción Gratuita sin vencimiento: `fecha_fin = 9999-12-31`.
- `GET /permisos`: catálogo de módulos y acciones para el editor de roles del panel. El mismo catálogo valida `permisos_json`.
- Horario partido: `horarios_negocio` admite varios rangos por día (se quita `UNIQUE(id_sucursal, dia_semana)`, migración 002). El servicio valida que los rangos de un mismo día no se crucen. El cálculo de horarios libres de la Fase 1 debe recorrer todos los rangos del día.
- Auth (0.C.2): los tokens llevan un `jti` aleatorio para que dos sesiones nunca tengan el mismo hash. `session.service.createSessionForUser(usuario, cliente, conn)` es la única forma de crear sesiones (login, invitaciones y `tokenDe` de los tests).
- `authMiddleware` toma `req.user` de la base (no del token) y responde 403 si el usuario está inactivo. El bloqueo por intentos no cierra las sesiones abiertas: solo impide iniciar sesión.
- Login: con la cuenta bloqueada no se evalúa la contraseña (403 directo); el intento que alcanza el límite ya responde 403. Al vencer el bloqueo el conteo empieza de nuevo. El registro no inicia sesión.
- Contraseña de registro: 8 a 72 caracteres (límite de bcrypt), con al menos una letra y un número. El body de register y login es estricto: campos no previstos -> 422.
- `authorize` deduce el negocio solo de parámetros de ruta (`:id_negocio` o un recurso del mapa de `negocio.repository`); si la ruta no tiene ninguno es un error de programación (500). Deja `req.negocio` y `req.acceso = { relacion, id_empleado?, id_rol?, permisos? }` para los servicios. Recursos globales (roles del sistema): solo el admin.
- Negocios, sucursales y roles (0.C.3): los routers de estos módulos definen rutas completas (`/negocios/:id_negocio/sucursales`, `/sucursales/:id_sucursal`...) y se montan en la raíz de `/api/v1`. En las rutas protegidas el orden es `authMiddleware`, `validate`, `authorize` (un id inválido da 422 antes de consultar la base).
- `authorize(modulo, accion)` lanza un error al cargar las rutas si el permiso no está en `CATALOGO_PERMISOS` (`shared/utils/permissions.js`). Si el catálogo cambia, actualizar los roles del sistema con una migración.
- Lectura pública sin token: perfil del negocio, sus sucursales y los horarios. El perfil devuelve 404 si el negocio está inactivo y solo muestra sucursales activas (con sus horarios), servicios activos y con `visible_app`, y las 5 reseñas visibles más recientes (autor como "Nombre I."). No expone `nit`, `razon_social` ni el propietario.
- Sucursal principal: la primera sucursal activa del negocio siempre queda como principal; marcar otra desmarca la anterior; desmarcar la principal da 409 (se marca otra). Eliminar (lógico) da 409 si hay citas futuras pendientes o confirmadas, o si es la principal y hay otras activas; la única sucursal sí se elimina. Estas operaciones bloquean las sucursales del negocio con `FOR UPDATE`.
- Horarios: el PUT recibe `{ horarios: [{ dia_semana, hora_apertura, hora_cierre }] }`; horas HH:MM (acepta HH:MM:SS) y se devuelven HH:MM. Los rangos pueden tocarse (12:00–12:00) pero no cruzarse; el 422 indica el índice (`horarios.N`). Lista vacía = cerrado toda la semana.
- Roles: nombre único en el negocio y distinto de los roles del sistema, sin distinguir mayúsculas (409). Los roles del sistema no se editan ni se borran, tampoco por el admin (403). Un rol con empleados asignados, activos o no, no se borra (409). Escalada: las reglas aplican a empleados; propietario y admin no tienen límite. Asignar un rol y cambiar el propio rol se controla en empleados (0.C.4).
- PATCH de negocio, sucursal y rol: lista blanca estricta (campos desconocidos -> 422), al menos un campo; los opcionales se vacían con `null`. `latitud` y `longitud` van juntas (ambas con valor o ambas `null`).
- Empleados (0.C.4): el body no acepta `id_usuario`, `id_negocio`, `activo` ni `fecha_retiro` (422). La cuenta se vincula solo con `empleadoRepo.linkUsuario` (invitaciones y, en 0.C.5, el propietario). `fecha_vinculacion` por defecto es hoy. `id_rol` debe ser del sistema o del mismo negocio (422 en `errors.id_rol`).
- Email del empleado único por negocio sin distinguir mayúsculas (409). Si el email es de un empleado inactivo, el 409 lo dice con su `id_empleado` para reactivarlo. Cambiar el email (sin contar mayúsculas) o desactivar invalida las invitaciones pendientes en la misma transacción. Desactivar a un inactivo o reactivar a un activo: 409.
- Listado de empleados: paginado, activos primero y luego apellido y nombre; filtros `activo` (true/false, sin filtro = todos) y `q` (nombre, apellido, nombre completo, email, documento). Cada fila trae `rol { id_rol, nombre }`, `tiene_cuenta` e `invitacion_pendiente` (sin usar y vigente); el detalle añade `rol.permisos_json`.
- Escalada en empleados (solo cuando actúa un empleado): no asignar un rol con permisos que el suyo no tiene, no cambiar su propio rol, no desactivarse a sí mismo y no editar, desactivar ni reactivar a un empleado con permisos que él no tiene (403). Puede editar sus propios datos salvo el rol.
- El propietario puede ser también empleado de su propio negocio (aparece en la agenda). En `authorize` y `/negocios/mios` cuenta como propietario, así que no le aplican las reglas de escalada: puede cambiar su propio rol de empleado o desactivarse como empleado sin perder el acceso.
- Un usuario solo puede estar vinculado una vez a cada negocio: `UNIQUE(id_negocio, id_usuario)` (migración 001), además de las validaciones del servicio.
- Invitaciones (0.C.5): token de 32 bytes aleatorios en hexadecimal; en la base solo su SHA-256. El token solo viaja en el correo (`${FRONTEND_URL}/invitacion/<token>`), nunca en respuestas. Vigencia de 72 horas; invalidar es poner `expiracion = NOW()`.
- Enviar da 409 si el empleado no tiene email, está inactivo, ya tiene cuenta o ya tiene una invitación vigente. Reenviar invalida la vigente y da 409 si nunca se invitó a ese email. Límite: 4 correos al mismo email del negocio en una ventana móvil de 24 horas (envío y reenvíos cuentan igual); el 409 dice desde cuándo se puede volver a enviar. Cambiar el email del empleado empieza un conteo nuevo. `intentos_reenvio` guarda cuántos correos se habían enviado a ese email en la ventana.
- El correo se envía dentro de la transacción que crea la invitación (con el empleado bloqueado): si falla, se deshace y responde 503. `SMTP_TIMEOUT_MS` (10 s por defecto) limita conexión, saludo e inactividad del SMTP para que la transacción no quede abierta.
- `GET /invitaciones/:token` y `POST /invitaciones/:token/aceptar` son públicos y van con el límite estricto de solicitudes. Invitación usada, vencida o reemplazada, empleado o negocio inactivos, o empleado ya vinculado: 409 con un mensaje por caso (no se usa 410).
- Aceptar: transacción con la invitación y el empleado bloqueados (`FOR UPDATE OF i, e`); el test de aceptaciones simultáneas con cuenta existente falla sin ese bloqueo. Con cuenta existente se exige la contraseña actual con las reglas del login (`auth.service.verificarPassword`: los fallos cuentan para el bloqueo de 5 intentos). Sin cuenta, se crea con `email_verificado = TRUE`, contraseña con las reglas del registro y nombre/apellido del empleado por defecto. Responde como el login e inicia sesión con `createSessionForUser`.
- Enviar y reenviar no aplican las reglas de escalada: el rol y el email del empleado ya pasaron esos controles al crearlo o editarlo.
- Propietario como empleado: `POST /negocios/:id_negocio/empleados/yo` solo para el propietario (se comprueba `negocios.id_usuario_propietario`, así que también funciona si el propietario es admin de plataforma). Rol por defecto Administrador. Si hay un empleado sin cuenta con su email lo vincula (200) y conserva su rol salvo que se envíe `id_rol`; si ese empleado está inactivo, 409 en lugar de reactivarlo.
- Migraciones (0.C.6): `schema_migrations (nombre, aplicada_en)` registra cada archivo aplicado. `db:migrate` aplica las pendientes en orden de nombre y registra cada una tras ejecutarla; si una falla se detiene sin registrarla (el DDL de MySQL no se deshace: revisar a mano). `--status` solo lee. `--baseline` marca todas las existentes sin ejecutarlas y solo con la tabla vacía. `petcat.sql` crea la tabla con todas las migraciones registradas; un test exige que cada archivo de `database/migrations` esté en ese `INSERT`. Sin checksum de archivos: los finales de línea CRLF/LF darían falsas alarmas.
- Codificación: `petcat.sql` y `dev_seed.sql` empiezan con `SET NAMES utf8mb4` (un test lo exige), porque el cliente `mysql` de compose usa latin1 y el texto con tildes quedaba codificado dos veces. Las bases creadas antes se reparan una sola vez con `database/scripts/reparar_codificacion_utf8.sql` (datos iniciales y trigger de citas; idempotente) o se recrean con `db:reset`. No es una migración porque una base nueva no la necesita. Los `COMMENT` de tablas y columnas de esas bases siguen dañados (solo documentación).
- El `errorHandler` ya no traduce `error.status` de errores comunes: solo `ApiError`, `ZodError`, errores de MySQL y de `express.json()`; lo demás es 500.
- CI: GitHub Actions con Node 24 y MySQL 8 de servicio (zona `America/Bogota`, puerto 3307); `backend/.env.test` se arma desde `.env.test.example` cambiando solo `DB_PASSWORD`.

### Decisiones de la Fase 1 (septiembre 2026)

**Auth (1.1)**
- Refresh token de 30 días (`REFRESH_EXPIRES_IN=30d`), renovado en cada uso: `POST /auth/refresh-token` rota los dos tokens en la misma fila de `sesiones` (bloqueada con `FOR UPDATE`) y mueve `expira_en`. El refresh token y el access token anteriores dejan de servir. Sin detección de reutilización en el MVP.
- El email sin verificar no bloquea el login ni las reservas en el MVP.
- Tokens de verificación y de recuperación: 32 bytes aleatorios; en la base solo su SHA-256, cada uno con su propio vencimiento (migración 004). Los enlaces van al frontend: `${FRONTEND_URL}/verificar-email/<token>` y `${FRONTEND_URL}/restablecer-password/<token>`.
- `PATCH /auth/me` no cambia el email (exigiría verificarlo de nuevo) ni la foto (Cloudinary, Fase 2). Si cambia el teléfono, `telefono_verificado` vuelve a FALSE.
- Vigencias: enlace de verificación 24 horas, enlace de recuperación 1 hora. Cada enlace nuevo invalida el anterior del mismo tipo. Máximo un correo por minuto por cuenta y tipo (se controla en el mismo `UPDATE` que guarda el token).
- El registro y `forgot-password` envían el correo sin esperarlo: si el SMTP falla solo se registra el error, así `forgot-password` responde igual y en el mismo tiempo exista o no el email. `resend-verification` sí lo espera, dentro de la transacción: si falla, 503 y no guarda el token.
- `forgot-password` no envía nada a cuentas desactivadas (misma respuesta). `reset-password` desbloquea la cuenta, marca el email como verificado (el enlace llegó a ese correo), cierra todas las sesiones y no inicia sesión.
- Enlace de verificación o de recuperación inexistente, usado o vencido: 400. Token con formato inválido (no son 64 caracteres hexadecimales): 422.
- `change-password`: contraseña actual incorrecta da 422 en `errors.password_actual`, no 401, para que el frontend no lo confunda con una sesión vencida. Los fallos cuentan para el bloqueo de 5 intentos; la nueva debe ser distinta de la actual.
- `verificarPassword(usuario, password, errorSiFalla)` recibe el `ApiError` del fallo (401 en login e invitaciones, 422 en el cambio de contraseña).
- La renovación de sesión funciona con la cuenta bloqueada por intentos (el bloqueo no cierra sesiones) y da 403 con la cuenta desactivada. Actualiza IP, user agent y `ultimo_acceso`.
- Límite estricto de solicitudes también en reset-password, verify-email y resend-verification. No en refresh-token: las apps lo llaman a menudo y muchos usuarios pueden compartir IP (p. ej. la wifi de la universidad).

**Mascotas (1.2)**
- Las rutas `/mascotas` son solo del dueño: una mascota de otro usuario da 403 (también para el admin de plataforma); inexistente o eliminada, 404. Los negocios verán las mascotas por sus citas (clientes, historial), no por estas rutas.
- `GET /mascotas` no es paginado (un dueño tiene pocas mascotas): excluye las eliminadas y deja las fallecidas al final. Cada mascota trae `edad_meses`, calculada en MySQL; no se devuelve `activo`.
- El body no acepta `id_usuario`, `activo` ni `foto_url` (la foto llega con Cloudinary en la Fase 2). El fallecimiento solo se registra al editar: `fallecido: true` con `fecha_fallecimiento` opcional (por defecto hoy, no futura ni anterior al nacimiento); `fallecido: false` borra la fecha. Una mascota fallecida no se queda sin fecha (422).
- Eliminar (lógico) o registrar el fallecimiento da 409 si la mascota tiene citas futuras pendientes o confirmadas. Ambas operaciones bloquean la fila de la mascota (`FOR UPDATE`); al reservar (1.5) hay que leerla con bloqueo para no reservar sobre una mascota que se está eliminando.
- Fechas "YYYY-MM-DD": `shared/utils/fechas.js` (`hoyISO`) y los esquemas `fecha` y `fechaNoFutura` de `shared/utils/schemas.js`.

**Servicios y búsqueda (1.3)**
- Servicios en la app sin empleados: se muestran igual con `reservable: false` (no requiere cita, o la requiere y tiene al menos un empleado activo asignado). También en el perfil público, junto con `precio_actual` y `oferta_vigente`.
- `GET /servicios/:id_servicio` es solo la vista pública (activo, visible y de negocio activo; 404 si no). El panel no tiene una ruta de detalle: su listado trae todos los datos, también de servicios eliminados u ocultos, y `PATCH` devuelve el servicio completo.
- `empleados` en el body: solo empleados activos del mismo negocio (422 en `errors.empleados` con los ids inválidos). Al editar reemplaza los empleados **activos** asignados; las asignaciones de empleados inactivos se conservan y vuelven a contar si se reactivan. `sin_empleados` y `reservable` solo cuentan empleados activos. Eliminar un servicio conserva sus asignaciones.
- `GET /empleados/:id_empleado` (y las respuestas de crear y editar empleado) trae `servicios`: los activos que atiende. Las asignaciones solo se editan desde el servicio.
- Nombre único entre los servicios activos del negocio, sin distinguir mayúsculas (409 en `errors.nombre`); se comprueba bloqueando la fila del negocio. Se puede editar un servicio eliminado; su nombre se comprueba al reactivarlo (409 si está ocupado o si ya está activo).
- Reglas entre campos (422), validadas contra los valores actuales al editar: `precio_maximo >= precio_base`, `peso_min_kg <= peso_max_kg`, con `en_oferta` se exige `precio_oferta < precio_base`, y `fecha_fin_oferta >= fecha_inicio_oferta`. `duracion_minutos` de 5 a 1440 y `margen_minutos` de 0 a 240, ambos múltiplos de 5. `tipo_mascota` y `dias_disponible` son arreglos (`todos` no se combina); `etiquetas` (hasta 10) se guarda en `etiquetas_json`.
- Eliminar un servicio (lógico) da 409 si tiene citas futuras pendientes o confirmadas; ya eliminado, 404.
- Búsqueda pública: solo negocios activos con al menos una sucursal activa. Con `lat`/`lng`, la distancia es la de la sucursal activa más cercana con coordenadas (`ST_Distance_Sphere`, con un recuadro previo); si ninguna sucursal activa tiene coordenadas se usan las del negocio (con su sucursal principal como `sucursal_cercana`), y los negocios sin coordenadas en ningún lado quedan fuera. Radio por defecto `configuracion_global.radio_busqueda_km` (10), máximo 50. `lat` y `lng` van juntas; `radio_km` exige ambas.
- Orden de `GET /negocios`: destacados primero; luego distancia (con coordenadas) o calificación y número de reseñas. Orden de `GET /servicios`: reservables primero; luego distancia (con coordenadas), negocio destacado, calificación del negocio y nombre.
- `especie` en `GET /servicios` encuentra los servicios de esa especie y los de `todos`. `en_oferta` filtra por oferta vigente hoy. `q` usa `LIKE` con `%` y `_` escapados (`shared/utils/sql.js`); la collation ignora tildes y mayúsculas.

**Disponibilidad (1.4)**
- El horario semanal (`horario_normal`) se reemplaza completo con `PUT /empleados/:id_empleado/horario-semanal` (como los horarios de sucursal: borra y vuelve a insertar esos registros). Bloqueos, vacaciones y eventos especiales son excepciones con fecha: `POST`, `PATCH` y `DELETE` (lógico); `PATCH` o `DELETE` sobre un registro del horario semanal da 409.
- Reglas por tipo: los rangos semanales de un mismo día no se cruzan, aunque sean de sucursales distintas (pueden tocarse; `id_sucursal` null = cualquier sucursal). `bloqueo`: uno o varios días, con horas opcionales y juntas (sin horas = días completos; con horas, ese rango cada día). `vacacion`: días completos. `evento_especial`: un solo día, con horas e `id_sucursal` obligatorios; no se cruza con otros eventos del empleado ese día en ninguna sucursal (422). Período máximo de 366 días. Al crear, el último día debe ser hoy o posterior. `recurrente` no se usa. Con el empleado inactivo, las escrituras dan 409. `PATCH` combina el body con la fila y lo valida con el esquema del tipo (el tipo no cambia; un campo de otro tipo da 422).
- Cálculo: `disponibilidad.calculo.js`, funciones puras sobre rangos en minutos (`calcularDisponibilidad`, `citaCabe`) que reutilizará 1.5. Reglas en la decisión del evento especial de más abajo. Un empleado inactivo no tiene disponibilidad.
- `citas_afectadas` viene en todas las escrituras (vacía si no hay): las citas futuras pendientes o confirmadas del empleado (las de hoy desde la hora actual) que **después del cambio** no caben en su disponibilidad, incluidas las que ya no cabían antes. Una cita sin sucursal solo se compara con bloqueos y vacaciones. El cambio se guarda igual.
- Lectura (`GET` de disponibilidad y de disponibilidad efectiva): `configuracion.ver`, `citas.ver` o el propio empleado, con `authorizeAny(permisos, { permitirSi })`. Escrituras: `configuracion.editar`. El empleado no registra sus propios bloqueos en el MVP.
- Las escrituras bloquean la fila del empleado (`FOR UPDATE` por clave primaria); en 1.5 las reservas bloquean la misma fila, así que un cambio de disponibilidad y una reserva del mismo empleado no se cruzan.
- Bloqueos con `FOR UPDATE`: bloquear por clave primaria, no por un índice secundario que la misma transacción modifica. La renovación del refresh token lo hacía y con 5 solicitudes simultáneas terminaba en deadlock (500); se corrigió buscando el id sin bloquear y bloqueando por id.
- Pendiente para 1.5: la agenda marca cada cita con `fuera_de_disponibilidad` y admite el filtro `fuera_de_disponibilidad=true`; cambiar el horario de una sucursal o desactivar un empleado también devuelve `citas_afectadas`.

**Servicios y agenda (1.3 a 1.5)**
- Qué empleados atienden un servicio: tabla `empleado_servicios`. Un empleado sin servicios asignados no aparece en la agenda; un servicio sin empleados asignados no se puede reservar. Al crear o editar un servicio se pueden enviar los empleados asignados en el mismo body; el listado del panel indica `sin_empleados`.
- Los servicios son del negocio y se ofrecen en todas sus sucursales. Las especies `pez` y `otro` solo son compatibles con servicios `todos`.
- Intervalo de la agenda: 15 minutos, alineados a :00, :15, :30 y :45 (`configuracion_global`). Los horarios candidatos son siempre de esa cuadrícula, aunque la duración del servicio sea de 5 en 5 minutos (p. ej. 10): `hora_fin` más el margen solo se usa para comprobar el cruce con otras citas, no para calcular el siguiente horario.
- Margen entre citas: `servicios.margen_minutos` (por defecto 0). Ocupa la agenda del empleado después de la cita, pero no cambia la `hora_fin` que ve el cliente.
- Un horario de inicio *t* es válido si:
  1. es futuro, con antelación mínima y horizonte máximo configurables;
  2. el día está en `servicios.dias_disponible` (NULL = todos);
  3. el bloque completo cabe dentro de un solo rango de `horarios_negocio` de ese día (no cruza el cierre del mediodía);
  4. cabe dentro de un rango `horario_normal` del empleado para esa sucursal o con `id_sucursal` NULL; un empleado sin ningún `horario_normal` sigue el horario de la sucursal;
  5. no se cruza con un bloqueo o una vacación (sin horas = día completo);
  6. no se cruza, contando el margen, con otra cita del empleado en cualquier sucursal en estado pendiente, confirmada o en curso;
  7. no se alcanzó `max_citas_dia`, que es por sucursal y día y cuenta todos los estados menos cancelada y reprogramada;
  8. la misma mascota no tiene otra cita a esa hora (409).
- `evento_especial` **suma** su rango a la disponibilidad del día, no la reemplaza (un veterinario que trabaja de 8 a 12 y agrega una jornada de 14 a 17 conserva su mañana). Para una sucursal y una fecha:
  1. base: los rangos `horario_normal` del día (de esa sucursal o con sucursal NULL), recortados por el horario de la sucursal; si el empleado no tiene ningún `horario_normal`, el horario de la sucursal;
  2. los eventos del empleado en **otra** sucursal ese día se restan de la base (el evento manda en ese rango);
  3. se suman los eventos en esta sucursal, sin recortarlos por el horario de la sucursal (p. ej. una jornada de vacunación un domingo);
  4. bloqueos y vacaciones restan al final, también sobre los eventos.

  Para reemplazar el día completo se combina un bloqueo **con horas** sobre el horario normal y el evento: un bloqueo de día completo también quita el evento.
- Sin `id_empleado`, cada horario libre lista los empleados disponibles; al reservar sin empleado se asigna el que tenga menos citas ese día.
- Doble reserva: se bloquea la fila del servicio (si tiene `max_citas_dia`) y la del empleado, en ese orden, en lugar de `SELECT ... FOR UPDATE` sobre las citas del día (con la agenda vacía eso usa *gap locks* y termina en deadlock en vez de 409).
- Estado inicial: citas de la app → `pendiente`; del panel → `confirmada`. Como el trigger `trg_citas_after_update` solo actúa en UPDATE, el servicio crea el recordatorio de las citas que nacen confirmadas.
- Una mascota fallecida o eliminada no recibe citas nuevas (tampoco por reprogramación). Igual que con otras referencias del body (p. ej. `id_rol` en empleados), un `id_mascota` inexistente, eliminado o de otro dueño da 422 en `errors.id_mascota`; una mascota fallecida da 409, porque es el estado del recurso. La mascota se lee con `FOR UPDATE` dentro de la transacción de la reserva.
- El dueño puede **cancelar siempre** desde la app (mientras la cita no haya empezado); si faltan menos de 2 horas (`antelacion_cancelacion_app_h`), la cita queda marcada como cancelación tardía y el panel lo ve. **Reprogramar** desde la app sí exige al menos 2 horas de anticipación; después, solo el negocio. (Revisado en el plan de 1.5.3.)
- `confirmada → en_curso` y `no_asistio` solo desde la fecha de la cita en adelante.
- `precio_estimado`: precio de oferta si está vigente; si no, `precio_base`.
- Panel sin cliente previo: búsqueda por email o teléfono exactos (datos mínimos y mascotas activas) y registro de un cliente sin app: se crea el usuario con email obligatorio y contraseña aleatoria (la reclama con `forgot-password`) y su mascota.
- `/citas/:id_cita`, el historial y las vacunas los usan el dueño y el negocio: hace falta un middleware "dueño o negocio autorizado" y resolvers de `id_historial` e `id_vacuna`.

**Reservas y clientes del panel (1.5.1)**
- Horarios libres en dos endpoints: `GET /citas/horarios-libres` (público, para la app) y `GET /negocios/:id_negocio/citas/horarios-libres` (`citas.crear`), que admite servicios ocultos del propio negocio y no aplica la antelación mínima (solo que el horario sea futuro). Lo mismo al reservar (`POST /citas` y `POST /negocios/:id_negocio/citas`).
- Configuración (`configuracion_global`, migración 007): `intervalo_agenda_min` 15, `antelacion_minima_reserva_min` 60, `horizonte_reserva_dias` 60, `antelacion_cancelacion_app_h` 2 (para 1.5.3) y `politica_datos_url`.
- El margen solo cuenta para los cruces entre citas (la nueva ocupa [t, t + duración + margen] y cada existente [inicio, fin + el margen de su servicio]); no tiene que caber en la disponibilidad. Ocupan agenda las citas pendientes, confirmadas y en curso, en cualquier sucursal.
- Día sin horarios: 200 con lista vacía y `motivo_sin_horarios` (día no ofrecido, sin cupos, sin disponibilidad). Fecha pasada o después del horizonte: 422. Servicio que no requiere cita o sin profesionales asignados: 409.
- Reserva: `hora_inicio` en la cuadrícula (422 si no). Mascota inexistente, eliminada o de otro dueño: 422 en `errors.id_mascota`; fallecida: 409; especie o peso fuera del servicio: 422 (sin peso registrado se permite). La mascota no puede tener otra cita que se cruce, en ningún negocio (409). Horario ya tomado o día sin cupos: 409.
- Transacción de la reserva: primero **todos** los bloqueos por clave primaria (servicio si tiene `max_citas_dia`, empleados candidatos en orden de id, mascota) y después las lecturas. En REPEATABLE READ la primera lectura sin bloqueo fija la foto de la transacción: si se leía algo antes de esperar un bloqueo, la reserva no veía la cita que otra transacción confirmó mientras tanto y reservaba encima (lo reproduce un test).
- Sin `id_empleado`, se asigna al empleado libre con menos citas ese día (todas menos canceladas y reprogramadas; a igualdad, el de menor id). `precio_estimado` = `precio_actual` del servicio.
- App: estado `pendiente`, origen `app_movil`. Panel: `confirmada`, origen `panel_web`, `presencial`, `telefono` o `whatsapp`, y el servicio inserta el recordatorio igual que el trigger (2 horas antes). La creación queda en `historial_citas` (`estado`: null → inicial, con el usuario y, si actuó un empleado, su `id_empleado`).
- Autorización de datos (Ley 1581 de 2012) en la tabla `autorizaciones_datos`, una fila por autorización: titular, canal (`app` o `panel`), negocio, quién la registró, versión de la política (`terminos_version`), fecha e IP; `revocada_en` queda para la revocación. `POST /auth/register` exige `acepta_politica_datos: true` (canal app); `POST /negocios/:id_negocio/clientes` exige `autoriza_tratamiento_datos: true` (canal panel).
- Regla general: toda cuenta nueva registra su autorización. Canales (migración 008): `app` (registro propio), `panel` (el negocio tomó la autorización del cliente), `invitacion` (el titular la da al aceptar una invitación que crea su cuenta; se guarda el negocio que invitó) y `aceptacion` (una cuenta existente acepta la versión vigente). `panel` no se reutiliza para los otros casos para no mezclar en la auditoría las autorizaciones que tomó un negocio con las que dio el propio titular.
- Invitaciones: con cuenta nueva, `acepta_politica_datos: true` es obligatorio (422 junto con los errores de la contraseña); con cuenta existente es opcional y, si se envía y no tenía una autorización vigente, se registra. `GET /invitaciones/:token` devuelve `requiere_aceptar_politica` (true si no hay cuenta).
- Autorización vigente: una fila no revocada para la versión actual (`terminos_version`). `GET /auth/me` devuelve `requiere_aceptar_politica` cuando no la hay (cuentas anteriores a la migración 007 o cambio de versión) y `POST /auth/politica-datos/aceptar` la registra (canal `aceptacion`); si ya existía no duplica y responde 200. Los usuarios del seed tienen su autorización.
- Registro de `POST /auth/register` con un email existente: el 409 sugiere usar "Olvidé mi contraseña" (la cuenta pudo crearla un negocio).
- Cliente sin app: usuario `cliente` con contraseña aleatoria que nadie conoce, su primera mascota y la autorización, en una transacción. Correo de bienvenida con el nombre del negocio, los datos guardados y su finalidad, la política (si hay URL) y un enlace de 7 días a `${FRONTEND_URL}/crear-password/<token>`, que usa el token de recuperación y `POST /auth/reset-password` (verifica el email). Se envía sin esperar; si falla, el cliente usa "Olvidé mi contraseña".
- Búsqueda de clientes (`citas.crear` o `clientes.ver`): email o teléfono exactos (solo dígitos), uno de los dos; hasta 5 usuarios activos con sus mascotas activas y vivas. Con el límite estricto de solicitudes para que no se puedan recorrer teléfonos.
- Otra mascota desde el panel (`citas.crear`): solo si el cliente tiene relación con el negocio, es decir, alguna cita con él (en cualquier estado) o una autorización registrada por ese negocio; si no, 403. Cliente inexistente o inactivo: 404.

**Consultas y agenda (1.5.2)**
- `GET /citas/mias`: paginado; `alcance` `proximas` (por defecto: las que no han terminado, de la más cercana a la más lejana), `pasadas` o `todas` (de la más reciente hacia atrás); filtros `estado` (lista separada por comas) e `id_mascota`.
- Agenda `GET /negocios/:id_negocio/citas` (`citas.ver`): `desde` y `hasta` por defecto hoy, máximo 31 días (422); sin paginar, con `meta { total, desde, hasta }`. Filtros `estado`, `id_sucursal`, `id_empleado` e `id_servicio` (deben ser del negocio, activos o no: 422 si no), `q` (nombre del cliente o de la mascota), `solo_mias` y `fuera_de_disponibilidad`.
- `solo_mias` es un filtro, no una restricción: limita a las citas del perfil de empleado activo de quien consulta en ese negocio (también el propietario registrado como empleado); sin perfil, 422; con otro `id_empleado`, 422. Si más adelante ciertos roles deben ver solo sus citas, se agrega un permiso (p. ej. `citas.ver_todas`).
- `fuera_de_disponibilidad` solo aplica a citas futuras pendientes o confirmadas con empleado (las de hoy desde la hora actual, como `citas_afectadas`); en las demás es false. Se calcula con `citaCabe` cargando en lote la disponibilidad de los empleados del rango.
- `GET /citas/:id_cita` con `authorizeDuenoO`: el personal del negocio de la cita con `citas.ver` (y propietario y admin) recibe la vista completa; el dueño, sin `notas_internas` ni `fuera_de_disponibilidad`; si es ambas cosas, gana la del personal; cualquier otro (también el personal de otros negocios), 403. El negocio se deduce de la cita, nunca de un parámetro.
- Toda cita trae `negocio { id_negocio, nombre, logo_url }` y `sucursal { id_sucursal, nombre, direccion, telefono, latitud, longitud }` (para "Cómo llegar" en la app).

**Cambios sobre citas (1.5.3)**
- Máquina de estados del panel (`PATCH /citas/:id_cita/estado`, `citas.editar`): pendiente → confirmada (el trigger programa el recordatorio); confirmada → en_curso (desde la fecha de la cita) o no_asistio (desde la **hora de inicio**); en_curso → completada (con `precio_final`, por defecto el estimado, y suma `negocios.total_citas` en la misma transacción); no_asistio → en_curso **solo el mismo día** (el cliente llegó tarde). completada, cancelada y reprogramada son finales. Cancelar y reprogramar tienen endpoints propios. Cualquier otro paso: 409 con las transiciones posibles.
- Cancelación (`POST /citas/:id_cita/cancelar`, dueño o `citas.cancelar`): solo pendientes o confirmadas. El dueño cancela siempre que la cita no haya empezado (409 después); a menos de `antelacion_cancelacion_app_h` horas queda `cancelacion_tardia`. El negocio exige motivo y puede cancelar también citas pasadas; nunca es tardía. Se guardan `cancelada_por`, `fecha_cancelacion` y `motivo_cancelacion` (migración 009) y se cancelan los recordatorios pendientes. `cancelacion_tardia` es columna, no se deduce del historial: se lee directo en el panel y se cuenta como las inasistencias.
- Reprogramación (`POST /citas/:id_cita/reprogramar`, dueño o `citas.editar`): solo pendientes o confirmadas; el dueño, hasta 2 horas antes de la cita original y con las reglas de la app (la nueva queda `pendiente`); el negocio, en cualquier momento y con las del panel (la nueva queda `confirmada`, con recordatorio). Usa `crearCita` con el mismo cálculo y los mismos bloqueos, en una transacción que primero bloquea y marca la original como `reprogramada` (así libera su horario y su cupo): si el horario nuevo no está libre, se deshace todo. Conserva servicio, mascota, precio estimado, origen, notas y prioridad; por defecto la misma sucursal. Una mascota fallecida no se reprograma (409). Historial en las dos citas.
- Edición del panel (`PATCH /citas/:id_cita`): `precio_final` solo en curso o completada; reasignar `id_empleado` solo pendiente o confirmada, bloqueando al empleado y comprobando su disponibilidad y cruces con `evaluarDia` (el mismo cálculo de la reserva). Solo los campos que cambian van al historial.
- Historial (`GET /citas/:id_cita/historial`): el panel ve todo con usuario y empleado; el dueño solo estado y empleado, con motivo y `realizado_por` (`dueno` o `negocio`), sin nombres del personal. Los cambios de empleado muestran nombres.
- Orden de bloqueo en toda la agenda: cita → servicio (si tiene `max_citas_dia`) → empleados (por id) → mascota, siempre por clave primaria y antes de cualquier lectura. La reserva descarta a los empleados que se desactivaron mientras esperaba el bloqueo (lo reproduce un test); la desactivación bloquea la fila del empleado.
- Inasistencias para la Fase 2: sin contador guardado; índice (id_negocio, id_usuario, estado) y `citaRepo.resumenCumplimiento(id_usuario, id_negocio)`, que cuenta **solo** las citas de ese negocio (completadas, inasistencias, cancelaciones tardías). El detalle de la cita en el panel lo trae como `cliente.historial_cumplimiento`; el dueño no lo ve.
- `PUT /sucursales/:id_sucursal/horarios` responde `{ horarios, citas_afectadas }` y `DELETE /empleados/:id_empleado` responde `{ empleado, citas_afectadas }` (todas las citas futuras activas del empleado).
- Notificaciones a la otra parte (el negocio cancela o reprograma, el dueño cancela): Fase 2.

**Historial y vacunas (1.6)**
- La cita previa que da a un negocio acceso al historial es cualquier cita excepto cancelada o reprogramada.
- `notas_internas` nunca se muestran al dueño ni a un negocio distinto del que las escribió.
- El historial médico lo edita solo el negocio que lo creó, sin límite de tiempo en el MVP.
- Al registrar una dosis nueva de la misma vacuna (mismo nombre sin distinguir mayúsculas), las anteriores cuentan como `no_aplica`, para que no aparezcan vencidas para siempre. El estado se calcula al leer y se guarda al escribir.
- Rutas: el dueño usa `/mascotas/:id_mascota/...`; el panel, `/negocios/:id_negocio/mascotas/:id_mascota/...`, porque la mascota no es de un negocio y un usuario puede ser personal de varios (el negocio no se toma de la query). Una mascota eliminada da 404 también al negocio.
- `compartir_historial` (migración 010, por defecto TRUE): con FALSE, cada negocio ve solo el **historial clínico** que creó (consultas, diagnósticos, tratamientos y archivos). Las **vacunas** son siempre visibles para un negocio con cita válida (evita revacunaciones innecesarias), y el estado de las vacunas se calcula sobre **todas**. Las alergias y condiciones médicas de la mascota también son siempre visibles. El dueño ve todo lo suyo, siempre sin `notas_internas`.
- Vacunas: `registrada_por` (`dueno` o `negocio`) e `id_usuario_registro` (migración 010); cada vacuna trae `tiene_comprobante` (calculado de `comprobante_url`) para que el veterinario distinga las que registró el dueño. La del dueño solo la edita el dueño; la de un negocio, solo ese negocio (`vacunas.editar`).
- Estado de una vacuna: se agrupan las dosis por nombre sin distinguir mayúsculas, tildes ni espacios; solo la más reciente (`fecha_aplicacion`) está vigente y las anteriores son `no_aplica`. La vigente es `vencido` si `fecha_proxima` < hoy, `proximo` si cae dentro de `dias_aviso_vacuna` (30) y `al_dia` en otro caso, también sin `fecha_proxima` (dosis única).
- `archivos` del historial y `comprobante_url` de las vacunas aceptan **solo URLs https** desde ya; la subida con Cloudinary (Fase 2) llenará esos mismos campos.
- Rol del sistema Veterinario con `vacunas.editar` (migración 011): `historial_medico` y `vacunas` tienen las mismas acciones (ver, crear, editar) en los roles clínicos; un test lo comprueba.
- Al crear o editar un registro con `peso_registro` que sea el más reciente de la mascota, se actualiza `mascotas.peso`.
- Bloqueos de la salud de una mascota: siempre mascota y luego registro o vacuna (por clave primaria), con la mascota de un registro buscada fuera de la transacción. Así el alta de una vacuna ligada a un registro (la llave foránea bloquea el registro) y la edición de ese registro no se cruzan en deadlock, y el recálculo de estados no se pisa con un alta simultánea.
- Resumen de salud (sobre lo visible para quien consulta): `vacunas_vencidas` (vigentes con `fecha_proxima` < hoy, con `dias_vencida`), `vacunas_proximas` (hoy ≤ `fecha_proxima` ≤ hoy + 30, con `dias_restantes`), `ultimo_control` (el registro de historial más reciente con fecha ≤ hoy o, si no hay, la última cita completada), `proximo_control` (el `proximo_control` más cercano ≥ hoy), `proxima_cita` (la pendiente o confirmada más cercana que no terminó: de cualquier negocio para el dueño, solo las suyas para un negocio) y `evolucion_peso` (puntos del historial de los últimos 24 meses, máximo 24, más el peso actual; `variacion_kg`, `variacion_pct` y `tendencia` sube/baja/estable con umbral de 5 %). Una mascota fallecida no trae alertas de vacunas ni próxima cita.

**Pendientes**
- Fase 2: cancelación automática de citas pendientes sin confirmar y opción por negocio para confirmar automáticamente.
- Por decidir: clientes que solo tienen teléfono (hoy el email es obligatorio para registrarlos desde el panel).
