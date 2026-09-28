# PetCat — Instrucciones para Claude Code

Lee este archivo completo antes de cualquier tarea. El plan detallado por fases está en `docs/PLAN.md`; revísalo al iniciar cada sesión y marca las casillas al terminar cada tarea.

## Qué es PetCat

Plataforma de servicios para mascotas en Sincelejo, Sucre (Colombia). Proyecto de emprendimiento universitario, CECAR 2026. Equipo: Amaurys (backend/API, dueño de este repo), Andrés (panel web React), Daniel (app móvil React Native), Sofía (UI/UX). El frontend y la app se construirán **después** sobre esta API, así que la API y su documentación Swagger son el contrato.

Es un **marketplace de dos lados**:

- **B2B – Panel web para negocios** (veterinarias, tiendas, peluquerías caninas, guarderías, entrenadores, clínicas). Gestionan sucursales, horarios, equipo con roles/permisos, servicios, agenda de citas, historia clínica, inventario, pedidos y reseñas. Pagan suscripción freemium:
  - Gratuito: 1 sucursal, 30 citas/mes, 3 empleados, 50 productos.
  - Pro: $120.000 COP/mes — 3 sucursales, citas/empleados/productos ilimitados, WhatsApp, estadísticas, 14 días de prueba.
  - Enterprise: $280.000 COP/mes — todo ilimitado, IA, API, gestor dedicado.
  - Además PetCat cobra 4 % de comisión sobre ventas (`configuracion_global.comision_plataforma_pct`).
- **B2C – App móvil para dueños de mascotas** (gratis). Registran mascotas, carnet de vacunas e historial, buscan negocios cercanos, agendan citas, compran productos, reciben recordatorios, dejan reseñas, comunidad y recomendaciones IA.

Reglas de dominio que guían el diseño:

1. **La mascota pertenece al dueño (usuario), no al negocio.** Un negocio solo accede a mascotas/dueños que tienen al menos una cita con él. "Clientes" de un negocio es una consulta sobre `citas`, no una tabla.
2. **La cita es el centro.** De ella salen historial médico, pagos, reseña (una por cita), recordatorios (trigger `trg_citas_after_update`) y movimientos de inventario.
3. **Los límites del plan se aplican en el backend** (middleware `checkPlanLimit`, Fase 2). `-1` = ilimitado.
4. **El acceso al panel de un negocio se decide por pertenencia**, no por `usuarios.tipo_usuario`: el usuario es propietario (`negocios.id_usuario_propietario`) o empleado **activo** con `id_usuario` vinculado. `tipo_usuario = 'admin'` es el super admin de la plataforma. Un mismo usuario puede ser dueño de mascotas y empleado a la vez.
5. **Un empleado puede trabajar en varios negocios.** El email de empleado es único por negocio (`UNIQUE(id_negocio, email)`), no global.
6. **Historial médico:** el dueño ve todo el de sus mascotas; un negocio ve el historial completo de una mascota solo si esa mascota tiene al menos una cita con él.

## Stack (decidido — no cambiar sin consultar)

- Node 24 LTS, Express 5, **JavaScript ES Modules** (no TypeScript).
- MySQL 8 con **`mysql2/promise` y SQL escrito a mano**. **No usar Prisma**: el esquema usa columnas `SET` (no soportadas por Prisma), triggers y vistas. `database/petcat.sql` es la fuente de verdad del esquema.
- Validación: **Zod**. Auth: JWT access + refresh, `bcryptjs` (no `bcrypt`). Docs: swagger-jsdoc + swagger-ui-express.
- Seguridad: helmet, cors, express-rate-limit. Logs: morgan.
- Correo: Nodemailer (en desarrollo, registrar el enlace en consola o usar Ethereal).
- Más adelante: Cloudinary + multer (imágenes), Socket.IO (notificaciones en tiempo real), node-cron (recordatorios), MercadoPago (única pasarela del MVP), Expo Push (notificaciones móviles), OpenAI gpt-4o-mini (Fase 4). **Sin Redis** en el MVP.
- Tests: Vitest + supertest contra una base `petcat_test`.
- Infra local: `docker-compose.yml` (MySQL expuesto en 3307, API en 3000).

## Estructura objetivo

```
PetCat/
├── CLAUDE.md
├── docker-compose.yml
├── database/
│   ├── petcat.sql              # esquema completo (fuente de verdad)
│   ├── migrations/NNN_descripcion.sql
│   └── seeds/dev_seed.sql
├── docs/
│   ├── PLAN.md                 # fases y checklist
│   └── petcat_api_docs_completa.html  # guía inicial (referencia, puede estar desactualizada)
└── backend/
    ├── .env.example
    ├── src/
    │   ├── server.js           # primera línea: import "./config/loadEnv.js" (dotenv, quiet)
    │   ├── app.js
    │   ├── config/             # loadEnv.js, env.js (validado con Zod), db.js, zod.js (mensajes en español)
    │   ├── docs/swagger.js
    │   ├── shared/
    │   │   ├── errors/ApiError.js
    │   │   ├── middlewares/    # auth, authorize, validate, errorHandler, notFound, rateLimit
    │   │   └── utils/          # response, pagination, transaction, pick, jwt, hash, permissions, mailer
    │   └── modules/<modulo>/
    │       ├── <modulo>.routes.js      # rutas + JSDoc Swagger
    │       ├── <modulo>.controller.js  # solo HTTP: lee req, llama service, responde
    │       ├── <modulo>.service.js     # reglas de negocio
    │       ├── <modulo>.repository.js  # solo SQL
    │       └── <modulo>.schemas.js     # esquemas Zod (body, params, query)
    └── tests/
```

## Convenciones obligatorias

**Rutas**
- Prefijo `/api/v1`. Recursos en español, plural, kebab-case (`/categorias-servicio`).
- Recursos que pertenecen a un negocio se anidan: `/negocios/:id_negocio/empleados`. Operaciones sobre un recurso ya creado van directo: `/empleados/:id_empleado`.
- Parámetros con el nombre de la columna (`:id_negocio`, `:id_empleado`, `:id_sucursal`, `:id_cita`...), porque `authorize` los usa para resolver el negocio.
- Acciones que no son CRUD como subrecurso con verbo: `POST /citas/:id_cita/cancelar`.

**Respuestas** (usar siempre los helpers de `shared/utils/response.js`)
```js
{ success: true,  message: "OK", data: {...} }
{ success: true,  message: "OK", data: [...], meta: { total, page, limit, totalPages, hasNext } }
{ success: false, message: "Descripción", errors: { campo: "detalle" } }
```

**Códigos HTTP:** 200, 201, 400 (malformado), 401 (sin token / token inválido), 403 (sin permiso o recurso ajeno), 404, 409 (duplicado, horario ocupado, estado inválido), 422 (validación Zod), 429, 500.

**Errores**
- Lanzar `ApiError` (`ApiError.notFound("Mascota no encontrada")`, `.forbidden()`, `.conflict()`, `.badRequest()`...). Nunca `throw new Error()` sin status.
- Express 5 propaga solo los errores de funciones `async`: **los controladores no llevan try/catch**. El `errorHandler` central traduce `ApiError`, `ZodError` → 422, `ER_DUP_ENTRY` → 409, errores de llave foránea → 409/400, JSON inválido → 400, y oculta detalles internos en producción.

**Validación:** cada ruta que recibe datos usa `validate({ body, params, query })` con esquemas de `<modulo>.schemas.js`. El controlador usa los datos ya validados.

**SQL y seguridad**
- Siempre consultas parametrizadas (`?`). **Nunca** construir nombres de columna a partir de datos del usuario. Los `UPDATE` dinámicos usan una lista blanca de campos (`pick`).
- Nunca devolver `password_hash`, `token_*`, `refresh_token` ni `credenciales_json`. Usar un `sanitizeUsuario` o seleccionar columnas explícitas.
- Operaciones que escriben en más de una tabla van en transacción (`withTransaction`).
- Verificar pertenencia: un dueño solo toca sus mascotas/citas; un negocio solo sus recursos. Nunca confiar en un `id_negocio` del body/query si se puede derivar del recurso.
- Borrado lógico (`activo = FALSE`) donde exista la columna.
- Fechas: zona `America/Bogota`. El pool usa `dateStrings: true` para que `DATE`/`TIME`/`DATETIME` no se desplacen por zona horaria.

**Permisos (`roles.permisos_json`)**
Formato `{ "modulo": ["accion", ...] }`. Módulos: `citas, servicios, inventario, clientes, empleados, pagos, roles, reportes, configuracion, historial_medico, vacunas`. Sucursales, horarios, disponibilidad y datos del negocio usan `configuracion`. Uso: `authorize("citas", "editar")`. El propietario del negocio y el admin de plataforma pasan siempre. Los empleados inactivos no pasan.

**Estilo**
- Mensajes al usuario, comentarios y Swagger en español. Nombres de funciones: verbo en inglés + entidad en español (`createEmpleado`, `findByNegocio`) — ya es el estilo del proyecto.
- Sin emojis en el código nuevo. Comentarios solo donde aporten.
- Cada endpoint nuevo o modificado queda documentado en Swagger (request, respuestas y errores).

## Forma de trabajar

- Trabajar en la rama de la fase (`fase-0`, `fase-1`...). Un commit por tarea lógica, con mensaje en español (`feat(citas): cálculo de horarios libres`).
- Antes de una tarea grande, mostrar el plan y esperar confirmación.
- Después de cada cambio: arrancar el servidor y probar los endpoints afectados (tests o curl). No dar por terminado algo sin verificarlo.
- **Cambios de esquema:** crear `database/migrations/NNN_descripcion.sql` **y** actualizar `database/petcat.sql` para que una instalación nueva quede igual, incluido su nombre en el `INSERT INTO schema_migrations` del final (un test lo comprueba). Avisar a Amaurys para que la aplique con `npm run db:migrate`.
- No leer ni modificar `backend/.env`; mantener `backend/.env.example` al día con cada variable nueva.
- Al terminar una tarea, marcarla en `docs/PLAN.md`. Si surge una decisión de diseño nueva, anotarla en la sección "Decisiones" de `docs/PLAN.md`.

## Comandos

```bash
docker compose up -d mysql        # solo la base de datos
cd backend && npm run dev         # API con nodemon en http://localhost:3000
npm test                          # Vitest
npm run db:migrate                # migraciones pendientes (--status para ver el estado)
npm run db:reset -- --yes         # recrea la base de backend/.env con esquema y seed
# Swagger: http://localhost:3000/api/v1/docs
```

Más detalle en `backend/README.md`. No correr el contenedor `backend` y `npm run dev` a la vez (mismo puerto y misma base).

**SQL en la terminal de Amaurys (PowerShell 5.1):** el SQL se pasa por tubería (`|`) al cliente de MySQL del contenedor, **no** con `-e "..."` (las comillas se rompen). Al darle comandos, usar este formato:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
"SELECT 1;" | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -t petcat_db'
Get-Content ruta/archivo.sql -Raw -Encoding UTF8 | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 petcat_db'
```

Para varias líneas, un here-string `@' ... '@` con el `'@` de cierre al inicio de la línea.

**Encadenar comandos:** PowerShell 5.1 no admite `&&` ni `||`. Los comandos que se le indiquen a Amaurys se separan con `;` (por ejemplo `cd backend; npm run db:migrate`), o se escriben en líneas separadas.
