# PetCat API

API REST de PetCat, la plataforma de servicios para mascotas de Sincelejo: panel web para negocios (B2B) y app móvil para dueños de mascotas (B2C).

- Node 24 LTS, Express 5, JavaScript (ES Modules), MySQL 8 con `mysql2` y SQL escrito a mano.
- Validación con Zod, autenticación con JWT, documentación con Swagger.
- Esquema de la base: [`database/petcat.sql`](../database/petcat.sql) (fuente de verdad). Plan por fases y decisiones: [`docs/PLAN.md`](../docs/PLAN.md).

Contenido:

1. [Levantar el proyecto desde cero](#1-levantar-el-proyecto-desde-cero)
2. [Variables de entorno](#2-variables-de-entorno)
3. [Base de datos: migraciones, seed y reinicio](#3-base-de-datos-migraciones-seed-y-reinicio)
4. [Tests](#4-tests)
5. [Swagger](#5-swagger)
6. [Consumir la API (panel web y app móvil)](#6-consumir-la-api-panel-web-y-app-móvil)

Los comandos están escritos para **PowerShell** en Windows; los de `npm` y `docker` son iguales en cualquier terminal.

---

## 1. Levantar el proyecto desde cero

### Requisitos

- [Node.js 24 LTS](https://nodejs.org/) (`node -v` debe mostrar `v24.x`).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) encendido.

### Pasos

Desde la raíz del repositorio (`PetCat/`):

```powershell
# 1. Contraseña de MySQL para docker compose
Copy-Item .env.example .env
#    Edita .env y cambia MYSQL_ROOT_PASSWORD.

# 2. Variables del backend
Copy-Item backend/.env.example backend/.env
Copy-Item backend/.env.test.example backend/.env.test
#    En los dos archivos, DB_PASSWORD es la misma MYSQL_ROOT_PASSWORD.
#    En backend/.env genera JWT_SECRET y REFRESH_SECRET (distintos entre sí):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Base de datos (MySQL queda en 127.0.0.1:3307)
docker compose up -d mysql

# 4. Dependencias y servidor en modo desarrollo (desde backend/)
cd backend
npm install
npm run dev
```

La API queda en `http://localhost:3000/api/v1` y Swagger en `http://localhost:3000/api/v1/docs`.

La primera vez que se crea el volumen de MySQL, compose carga automáticamente el esquema (`database/petcat.sql`) y los datos de desarrollo (`database/seeds/dev_seed.sql`). Si el volumen ya existía, no se vuelven a cargar: para empezar de cero usa `npm run db:reset -- --yes` (ver [sección 3](#3-base-de-datos-migraciones-seed-y-reinicio)).

### Dos formas de correr el backend

| Forma | Comando | Para qué |
|---|---|---|
| Solo la base en Docker y la API con nodemon | `docker compose up -d mysql` + `npm run dev` (en `backend/`) | Desarrollar el backend: recarga al guardar. |
| Todo en Docker | `docker compose up -d --build` | Andrés y Daniel, que solo consumen la API. |

> **No corras el contenedor `backend` y `npm run dev` a la vez.** Los dos usan el puerto 3000 y la misma base: el segundo no arranca, o terminas probando contra el que no es. Antes de `npm run dev`, detén el contenedor con `docker compose stop backend`; para volver a Docker, detén nodemon (Ctrl+C) y usa `docker compose up -d backend`.

`npm run dev` y los scripts de `npm` se ejecutan **desde `backend/`**, porque leen `backend/.env` del directorio actual.

---

## 2. Variables de entorno

Hay tres archivos, ninguno se sube al repositorio (solo sus plantillas `.example`):

| Archivo | Lo usa | Contenido |
|---|---|---|
| `.env` (raíz) | `docker compose` | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` |
| `backend/.env` | `npm run dev`, `npm start`, scripts `db:*` y el contenedor backend | Variables de la tabla de abajo |
| `backend/.env.test` | Vitest (`npm test`) | Las mismas, apuntando a la base `petcat_test` |

`src/config/env.js` valida todas las variables al arrancar: si falta una obligatoria o tiene un valor inválido, el servidor no arranca y dice cuál es.

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `NODE_ENV` | | `development` | `development`, `test` o `production` |
| `PORT` | | `3000` | Puerto de la API |
| `DB_HOST` / `DB_PORT` | | `localhost` / `3306` | Con compose: `localhost` y `3307` |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Sí | | Usuario, contraseña y base (`petcat_db`; en tests debe terminar en `_test`) |
| `JWT_SECRET` / `REFRESH_SECRET` | Sí | | Mínimo 32 caracteres y distintos entre sí |
| `JWT_EXPIRES_IN` / `REFRESH_EXPIRES_IN` | | `1h` / `30d` | Vigencia del access token y del refresh token (y de la sesión); el refresh token se renueva en cada uso |
| `APP_URL` | | `http://localhost:3000` | URL pública de la API |
| `FRONTEND_URL` | | `http://localhost:5173` | Panel web; base de los enlaces de los correos |
| `CORS_ORIGINS` | | `http://localhost:5173` | Orígenes permitidos, separados por coma |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | En producción | puerto `587` | Sin `SMTP_HOST`, en desarrollo los correos se muestran en la consola |
| `SMTP_TIMEOUT_MS` | | `10000` | Tiempo máximo del SMTP; si se supera, el envío responde 503 |
| `MAIL_FROM` | | `PetCat <no-reply@petcat.co>` | Remitente de los correos |
| `AUTH_RATE_LIMIT_MAX` | | 10 en producción, 100 en desarrollo | Máximo cada 15 min por IP en login, forgot-password, reset-password, verify-email, resend-verification e invitaciones |

Cada variable nueva se agrega también a `backend/.env.example`.

---

## 3. Base de datos: migraciones, seed y reinicio

### Migraciones

Los cambios de esquema van en `database/migrations/NNN_descripcion.sql` **y** en `database/petcat.sql`, para que una instalación nueva quede igual que una base migrada. La tabla `schema_migrations` registra cada migración aplicada **por nombre de archivo**.

```powershell
npm run db:migrate                 # aplica las pendientes, en orden
npm run db:migrate -- --status     # muestra aplicadas y pendientes (no cambia nada)
npm run db:migrate -- --baseline   # marca todas las existentes como aplicadas SIN ejecutarlas
```

- Usan la base de `backend/.env` y se corren desde el host (no desde el contenedor backend).
- Una base creada con `petcat.sql` (volumen nuevo de compose, `db:reset` o los tests) ya trae registradas todas las migraciones existentes: `db:migrate` no tiene nada que hacer.
- Si una migración falla, `db:migrate` se detiene, no la registra y no aplica las siguientes. MySQL confirma cada sentencia DDL al ejecutarla, así que puede quedar aplicada a medias: revisa la base antes de corregirla y reintentar.
- Al crear una migración nueva: agrega su nombre al `INSERT INTO schema_migrations` del final de `petcat.sql`. Un test falla si falta.

#### Bases creadas antes de `db:migrate` (baseline, una sola vez)

La base de desarrollo de Amaurys tiene aplicadas a mano la 001, la 002 y la 003, pero todavía no tiene la tabla `schema_migrations`. En una base así se ejecuta **una sola vez**, antes de que exista cualquier migración nueva:

```powershell
npm run db:migrate -- --baseline
```

Marca como aplicadas todas las migraciones que hay en `database/migrations` sin ejecutarlas. Por eso hay que hacerlo **antes** de agregar la 004: si no, la 004 quedaría marcada sin haberse aplicado. Solo funciona con la tabla vacía; a partir de ahí se usa `npm run db:migrate`.

### Seed de desarrollo

`database/seeds/dev_seed.sql` crea el negocio de ejemplo "Clínica Veterinaria Patitas" (plan Gratuito, una sucursal con horario partido, servicios), sus empleados, un cliente con dos mascotas y los usuarios de la [sección 6](#usuarios-de-prueba). Se carga solo con un volumen nuevo de compose o con `db:reset`.

### Reiniciar la base

```powershell
npm run db:reset -- --yes            # BORRA la base de backend/.env y la recrea con esquema + seed
npm run db:reset -- --yes --sin-seed # solo el esquema
```

Se niega a correr con `NODE_ENV=production` o sin `--yes`.

### Tildes dañadas en bases creadas antes del arreglo de codificación

Hasta el cierre de la Fase 0, compose cargaba `petcat.sql` y el seed con el cliente `mysql` en latin1, y el texto con tildes quedaba codificado dos veces (`VacunaciÃ³n` en lugar de `Vacunación`). Afecta los datos iniciales (planes, roles del sistema, categorías, configuración), el mensaje del trigger de recordatorios de citas y, si se cargó, el seed. Los datos creados por la API están bien. Para comprobarlo:

```powershell
"SELECT nombre FROM categorias_servicio LIMIT 2;" | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -t petcat_db'
```

- **Base sin datos propios:** `npm run db:reset -- --yes`.
- **Base con datos que hay que conservar:** aplica una sola vez `database/scripts/reparar_codificacion_utf8.sql`, que corrige esos datos iniciales y vuelve a crear el trigger (repetirlo no cambia nada). No es una migración: una base nueva no lo necesita. No corrige los datos del seed, que se recuperan con `db:reset`.

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Get-Content database/scripts/reparar_codificacion_utf8.sql -Raw -Encoding UTF8 | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 petcat_db'
```

### Ejecutar SQL a mano (PowerShell)

En PowerShell el SQL se pasa por tubería (`|`) al cliente de MySQL del contenedor, no con `-e "..."`:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)   # para que las tildes lleguen bien
"SELECT nombre, aplicada_en FROM schema_migrations;" | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -t petcat_db'

# Un archivo .sql
Get-Content database/migrations/003_rol_administrador_permisos.sql -Raw -Encoding UTF8 | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 petcat_db'
```

MySQL avisa en rojo que la contraseña va en la línea de comandos: es solo una advertencia.

---

## 4. Tests

```powershell
npm test            # toda la suite (Vitest + supertest)
npm run test:watch  # modo observación
```

- Necesitan MySQL encendido (`docker compose up -d mysql`) y `backend/.env.test`.
- Cada corrida **borra y recrea** la base `petcat_test` con `petcat.sql` y el seed; nunca toca `petcat_db` (`env.js` exige que `DB_NAME` termine en `_test`).
- Los correos no salen a la red: se guardan en memoria para que los tests lean los enlaces.
- En GitHub, el workflow `.github/workflows/tests.yml` corre la suite con un MySQL de servicio en cada PR y en cada push a `main`.

---

## 5. Swagger

- Interfaz: `http://localhost:3000/api/v1/docs` ("Try it out" funciona contra el mismo servidor).
- Especificación OpenAPI en JSON: `http://localhost:3000/api/v1/docs.json`.
- Cada endpoint nuevo o modificado se documenta en el JSDoc `@swagger` de su `<modulo>.routes.js`, con request, respuestas y errores.
- Para probar rutas protegidas: haz login en `POST /auth/login`, copia `data.access_token` y pégalo en **Authorize**.

---

## 6. Consumir la API (panel web y app móvil)

Sección para Andrés (panel web, React) y Daniel (app móvil, React Native).

### URL base y documentación

- URL base: `http://localhost:3000/api/v1` (en el emulador de Android: `http://10.0.2.2:3000/api/v1`; en un celular físico, la IP de tu PC en la red local, p. ej. `http://192.168.1.20:3000/api/v1`).
- **Swagger es el contrato**: `/api/v1/docs` para explorar y probar, y `/api/v1/docs.json` para generar tipos o clientes (por ejemplo con `openapi-typescript` u `orval`).
- `GET /api/v1/health` responde si la API y la base están arriba.

### Formato de las respuestas

Todas las respuestas son JSON con esta forma:

```jsonc
// Éxito
{ "success": true, "message": "OK", "data": { /* objeto */ } }

// Éxito con lista paginada (?page=1&limit=20; limit máximo 100)
{
  "success": true, "message": "OK", "data": [ /* ... */ ],
  "meta": { "total": 45, "page": 1, "limit": 20, "totalPages": 3, "hasNext": true }
}

// Error
{ "success": false, "message": "Datos inválidos", "errors": { "email": "Correo electrónico inválido" } }
```

- `message` está en español y se puede mostrar al usuario.
- `errors` aparece en los errores de validación (y en algunos 409): la llave es el campo, con punto en los anidados (`horarios.1.hora_cierre`). Úsalo para marcar cada campo del formulario.
- Los campos van en `snake_case`, como en la base. Fechas: `"YYYY-MM-DD"` y `"YYYY-MM-DD HH:MM:SS"` en hora de Colombia; horas de horario: `"HH:MM"`.
- En los `PATCH` se envía solo lo que cambia; `null` vacía un campo opcional. Un campo que el endpoint no acepta responde 422 (`"Campo no permitido"`).

### Códigos HTTP

| Código | Significa | Qué hacer en el cliente |
|---|---|---|
| 200 / 201 | OK / creado | |
| 400 | Solicitud malformada (p. ej. JSON inválido) | Error de programación |
| 401 | Sin token, token inválido o vencido, sesión cerrada | Volver al login |
| 403 | Sin permiso, recurso de otro negocio, cuenta desactivada o bloqueada | Mostrar `message` |
| 404 | No existe | |
| 409 | Duplicado, estado inválido o regla de negocio (p. ej. email en uso) | Mostrar `message` |
| 422 | Validación | Marcar los campos de `errors` |
| 429 | Demasiadas solicitudes | Esperar y reintentar |
| 503 | Un servicio externo falló (p. ej. el correo) | Reintentar más tarde |

### Autenticación

1. `POST /auth/login` con `{ "email", "password" }` (la app puede enviar además `"dispositivo": "android"`). Responde `data: { access_token, refresh_token, usuario }`.
2. En cada petición protegida: cabecera `Authorization: Bearer <access_token>`.
3. El access token vence en 1 hora (`JWT_EXPIRES_IN`). Con un 401 por token vencido, llama a `POST /auth/refresh-token` con `{ "refresh_token" }`: devuelve un access token y un refresh token **nuevos** (guarda los dos; los anteriores dejan de servir) y extiende la sesión 30 días más (`REFRESH_EXPIRES_IN`). Si el refresh también da 401, vuelve a hacer login. No lances dos renovaciones a la vez con el mismo refresh token: solo una funciona.
4. `POST /auth/logout` cierra solo la sesión de ese token. `POST /auth/change-password` cierra las demás sesiones y mantiene la actual.
5. Tras 5 contraseñas erróneas seguidas la cuenta se bloquea 15 minutos (403). Restablecer la contraseña la desbloquea.
6. `GET /auth/me` devuelve el perfil, las preferencias y los negocios a los que puede entrar; `PATCH /auth/me` edita nombre, apellido, teléfono, idioma, zona horaria y notificaciones.

Registro: `POST /auth/register` con `nombre`, `apellido`, `email`, `password` (8 a 72 caracteres, con letra y número), y opcionales `telefono` y `tipo_usuario` (`cliente` o `negocio`). No inicia sesión. Envía un correo de verificación; el email sin verificar no impide iniciar sesión ni reservar.

Pantallas del frontend que abren los enlaces de los correos (el token va en la ruta):

| Enlace | Qué hace la pantalla |
|---|---|
| `${FRONTEND_URL}/verificar-email/<token>` | Llama a `GET /auth/verify-email/:token` y muestra el resultado (400 = enlace vencido o ya usado). Reenviar el correo: `POST /auth/resend-verification` con la sesión iniciada. |
| `${FRONTEND_URL}/restablecer-password/<token>` | Pide la contraseña nueva y envía `POST /auth/reset-password` con `{ "token", "password" }`. Luego, login. El enlace se pide con `POST /auth/forgot-password` (vigente 1 hora). |

### Acceso al panel de un negocio

- El acceso se decide por **pertenencia**, no por `tipo_usuario`: el usuario es propietario del negocio o empleado activo con su cuenta vinculada. Cualquier usuario puede crear un negocio (`POST /negocios`).
- `GET /negocios/mios` devuelve los negocios a los que el usuario puede entrar, con `relacion` (`propietario` o `empleado`) y su `rol`. Úsalo para el selector de negocio del panel.
- Los empleados tienen permisos por rol (`{ modulo: [acciones] }`); el catálogo completo está en `GET /permisos`. Un 403 dice qué falta.
- Invitaciones de empleados: el panel envía la invitación y el empleado recibe el enlace `${FRONTEND_URL}/invitacion/<token>`. La pantalla de ese enlace consulta `GET /invitaciones/:token` (dice si la cuenta ya existe) y acepta con `POST /invitaciones/:token/aceptar`, que devuelve la sesión igual que el login.

### Endpoints actuales

Detalle de cada uno en Swagger.

| Módulo | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh-token`, `GET` y `PATCH /auth/me`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/verify-email/:token`, `POST /auth/resend-verification` |
| Negocios | `POST /negocios`, `GET /negocios/mios`, `GET /negocios/:id_negocio` (público), `PATCH /negocios/:id_negocio` |
| Sucursales | `GET` (público) y `POST /negocios/:id_negocio/sucursales`, `GET` (público), `PATCH` y `DELETE /sucursales/:id_sucursal` |
| Horarios | `GET` (público) y `PUT /sucursales/:id_sucursal/horarios` |
| Roles y permisos | `GET /permisos`, `GET` y `POST /negocios/:id_negocio/roles`, `PATCH` y `DELETE /roles/:id_rol` |
| Empleados | `GET` (paginado) y `POST /negocios/:id_negocio/empleados`, `POST /negocios/:id_negocio/empleados/yo`, `GET`, `PATCH` y `DELETE /empleados/:id_empleado`, `PATCH /empleados/:id_empleado/reactivar` |
| Invitaciones | `POST /empleados/:id_empleado/invitacion`, `POST /empleados/:id_empleado/invitacion/reenviar`, `GET /invitaciones/:token` (público), `POST /invitaciones/:token/aceptar` (público) |
| Mascotas (app) | `GET` y `POST /mascotas` (del usuario autenticado), `GET`, `PATCH` y `DELETE /mascotas/:id_mascota` |
| Servicios | `GET /categorias-servicio` (público), `GET` (paginado) y `POST /negocios/:id_negocio/servicios`, `GET /servicios/:id_servicio` (público), `PATCH` y `DELETE /servicios/:id_servicio`, `PATCH /servicios/:id_servicio/reactivar` |
| Búsqueda (app) | `GET /negocios` y `GET /servicios` (públicos, paginados) |
| Disponibilidad | `GET` y `POST /empleados/:id_empleado/disponibilidad`, `PUT /empleados/:id_empleado/horario-semanal`, `GET /empleados/:id_empleado/disponibilidad-efectiva`, `PATCH` y `DELETE /disponibilidad/:id_disponibilidad` |

### Disponibilidad de empleados

- **Horario semanal** (`PUT .../horario-semanal`, la semana completa en un solo guardado). Si un empleado no tiene horario semanal, sigue el de la sucursal; en cuanto se le carga uno, solo trabaja en esos rangos. Un rango sin `id_sucursal` vale para cualquier sucursal.
- **Excepciones** (`POST .../disponibilidad`): `bloqueo` (con o sin horas, uno o varios días), `vacacion` (días completos) y `evento_especial` (un día, en una sucursal, que **suma** horas, incluso fuera del horario de la sucursal). Para que un día quede solo con el evento, se combina con un bloqueo **con horas** sobre el horario normal: un bloqueo de día completo también quita el evento.
- `GET .../disponibilidad-efectiva?fecha=` devuelve los rangos resultantes por sucursal; sirve para pintar el calendario del empleado.
- Toda escritura responde `data.citas_afectadas`: citas futuras pendientes o confirmadas que ya no caben en la disponibilidad del empleado. El cambio se guarda igual; el panel debe mostrarlas para reprogramarlas o reasignarlas.

### Servicios y búsqueda

- Cada servicio tiene sus **empleados asignados** (`empleados: [id_empleado]` en el body de crear y editar; al editar reemplaza el conjunto). En el listado del panel, `sin_empleados: true` avisa que el servicio no se puede reservar: conviene mostrar una alerta para que el negocio asigne a alguien. El detalle de un empleado (`GET /empleados/:id_empleado`) trae los `servicios` que atiende.
- En la app, los servicios no reservables se muestran igual con `reservable: false` (deshabilitar el botón de reservar). `precio_actual` ya tiene en cuenta la oferta vigente.
- `GET /negocios` y `GET /servicios` aceptan `lat`, `lng` y `radio_km` (por defecto 10 km, máximo 50). **Con coordenadas, los negocios que no tienen coordenadas en ninguna sucursal activa ni en el negocio quedan fuera de los resultados.** El panel debería pedir la ubicación al crear una sucursal y avisar al negocio si ninguna la tiene, porque sin ella no aparece en "cerca de mí". La distancia (`distancia_km`) es la de la sucursal más cercana (`sucursal_cercana`).
- Los textos de búsqueda (`q`) no distinguen tildes ni mayúsculas: "bano" encuentra "Baño".

### Usuarios de prueba

Con el seed cargado, todos usan la contraseña **`Petcat123!`**:

| Email | Rol en los datos de ejemplo |
|---|---|
| `admin@petcat.test` | Super admin de la plataforma |
| `propietario@petcat.test` | Dueña de "Clínica Veterinaria Patitas" |
| `veterinario@petcat.test` | Empleado con rol Veterinario |
| `cliente@petcat.test` | Dueña de las mascotas Max y Luna |

Invitación pendiente de la recepcionista (`recepcionista@petcat.test`, sin cuenta), para probar la pantalla de aceptar:
`http://localhost:5173/invitacion/5eed000000000000000000000000000000000000000000000000000000000001`

### CORS y límites

- El navegador solo puede llamar a la API desde los orígenes de `CORS_ORIGINS` (por defecto `http://localhost:5173`, el de Vite). Si el panel corre en otro puerto, agrégalo en `backend/.env`.
- La app móvil no envía cabecera `Origin`, así que CORS no la afecta.
- Límite general: 300 solicitudes cada 15 minutos por IP. Login, forgot-password, reset-password, verify-email, resend-verification e invitaciones tienen un límite más estricto (`AUTH_RATE_LIMIT_MAX`). Al superarlo: 429.
- En desarrollo sin SMTP, los correos (por ejemplo, las invitaciones) se imprimen en la consola del backend (`docker compose logs -f backend` si corre en Docker).
