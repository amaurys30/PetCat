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

### Dos backends en Docker: desarrollo y demo del panel

| Servicio | Contenedor | Dirección | Base | Para qué |
|---|---|---|---|---|
| `backend` | `petcat_backend` | `http://localhost:3000` | `petcat_db` | La API de siempre (desarrollo del backend, app móvil) |
| `backend-demo` | `petcat_backend_demo` | `http://127.0.0.1:3001` | `petcat_demo` | El panel web (`frontend/web`) y sus pruebas, con datos conocidos |

`backend-demo` usa la misma imagen y el mismo `backend/.env`; solo cambia la base, el puerto y los límites de solicitudes (`RATE_LIMIT_MAX` y `AUTH_RATE_LIMIT_MAX` mucho más altos, para que las pruebas de punta a punta no reciban 429). Está en el **perfil `panel`**: un `docker compose up -d` normal no lo arranca. La primera vez crea `petcat_demo` con el esquema y el seed.

Cada servicio puede correr en dos modos:

- **Normal** (`docker-compose.yml`): la imagen lleva el código copiado; un cambio en la API pide reconstruirla (`--build`).
- **Desarrollo** (`docker-compose.yml` + `docker-compose.dev.yml`): el código de `backend/` se monta en el contenedor y **nodemon reinicia la API al guardar**, sin reconstruir. `node_modules` sigue siendo el del contenedor (Linux): si cambia `package.json`, se reconstruye con `--build -V`.

```powershell
# Desde la raíz del repositorio (PetCat/)

# Los dos backends en modo desarrollo (recarga al guardar)
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile panel up -d --build

# Solo la API del panel en modo desarrollo, sin tocar petcat_backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile panel up -d --build backend-demo

# Los dos en modo normal (imagen con el código copiado)
docker compose --profile panel up -d --build

# Estado y salud
docker compose --profile panel ps
Invoke-RestMethod http://localhost:3000/api/v1/health
Invoke-RestMethod http://localhost:3001/api/v1/health

# Recargar petcat_demo con el esquema y el seed (borra lo que hayas creado en la demo)
docker compose exec backend-demo node scripts/db-demo.js

# Ver los correos de desarrollo (recuperación, invitaciones, verificación...): llegan a
# Mailpit, http://127.0.0.1:8025 (ver "Correo" en la sección 2)
docker compose exec backend-demo npm run mail:test -- --to prueba@ejemplo.com

# Detener solo la API del panel
docker compose stop backend-demo
```

Para no repetir los `-f` y el perfil, se pueden poner en el `.env` de la raíz (ver `.env.example`); desde ese momento `docker compose up -d` usa el modo desarrollo y levanta los dos backends:

```
COMPOSE_FILE=docker-compose.yml;docker-compose.dev.yml
COMPOSE_PROFILES=panel
```

- Las dos APIs corren los jobs (recordatorios, confirmaciones…), cada una sobre su base.
- En modo desarrollo, nodemon revisa `backend/src` cada poco tiempo (`--legacy-watch`), porque los cambios en archivos de Windows no llegan al contenedor como eventos.
- `npm run db:migrate` solo migra `petcat_db`. `petcat_demo` se recarga con `scripts/db-demo.js`, porque `petcat.sql` ya trae todas las migraciones.

### Tareas programadas (jobs)

El servidor (`npm run dev`, `npm start` o el contenedor) corre estas tareas con node-cron, en hora de Bogotá. Los tests no las arrancan: llaman a cada función directamente.

| Job | Cuándo | Qué hace |
|---|---|---|
| `envios-notificaciones` | Cada minuto | Envía las push y los correos programados (fin del horario de silencio) y los reintentos |
| `recibos-expo` | Cada 15 min | Revisa los recibos de Expo y desactiva tokens dados de baja |
| `recordatorios-citas` | Cada minuto | Recordatorio del día anterior (19:00) y de 2 horas antes |
| `confirmaciones` | Cada minuto | Aviso al negocio a mitad del plazo para confirmar y cancelación automática de las citas pendientes que vencen |
| `invitaciones-resena` | Cada 5 min | Invita al dueño a reseñar 3 horas después de completada la cita (nunca entre las 20:00 y las 10:00) |
| `estado-vacunas` | 00:05 | Corrige la columna `vacunas.estado` |
| `suscripciones` | 00:10 | Vence pruebas y planes (`plan_vencido`) y avisa la prueba por terminar |
| `recordatorios-vacunas` | 09:00 | Vacunas 7 días antes, el día y 7 días después |
| `archivos-por-eliminar` | Cada hora | Reintenta borrar en Cloudinary lo que quedó `por_eliminar` |
| `sesiones` | 03:30 | Borra sesiones vencidas hace más de 30 días y tokens de correo vencidos |
| `limpieza-notificaciones` | Domingos 04:00 | Borra notificaciones leídas de más de 90 días, todas las de más de 180 y recordatorios viejos |

`estado-vacunas`, `suscripciones` y `recordatorios-vacunas` también corren una vez al arrancar, para recuperar lo que no corrió con el servidor apagado. Todos son seguros si hay dos instancias a la vez (por ejemplo durante un despliegue), pero en desarrollo sigue valiendo no correr el contenedor `backend` y `npm run dev` a la vez.

---

## 2. Variables de entorno

Hay tres archivos, ninguno se sube al repositorio (solo sus plantillas `.example`):

| Archivo | Lo usa | Contenido |
|---|---|---|
| `.env` (raíz) | `docker compose` | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MAIL_MODO` y `MAIL_MODO_DEMO` (correo de cada backend, ver "Correo") |
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
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | `SMTP_HOST` en producción | puerto `587` | Sin `SMTP_HOST`, en desarrollo los correos se muestran en la consola. Usuario y contraseña van juntos (o ninguno: sin autenticación). En Docker, el modo `mailpit` los reemplaza (ver "Correo") |
| `SMTP_SECURE` | | según puerto y usuario | `tls` (465), `starttls` (587) o `none` (Mailpit). Sin definir: 465 → `tls`; con usuario → `starttls`; sin usuario → `none` |
| `SMTP_TIMEOUT_MS` | | `10000` | Tiempo máximo del SMTP; si se supera, el envío responde 503 |
| `MAIL_FROM` | | `PetCat <no-reply@petcat.co>` | Remitente de los correos |
| `RATE_LIMIT_MAX` | | 300 | Máximo cada 15 min por IP en toda la API (límite general). La API de demo (`backend-demo`) usa uno mucho más alto |
| `AUTH_RATE_LIMIT_MAX` | | 10 en producción, 100 en desarrollo | Máximo cada 15 min por IP en login, forgot-password, reset-password, verify-email, resend-verification, request-verification e invitaciones |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | En producción | | Credenciales de Cloudinary (las tres juntas). En desarrollo, sin ellas la API funciona pero las subidas de archivos responden 503. Los tests no las usan |
| `CLOUDINARY_FOLDER` | | `petcat-dev` | Carpeta raíz en Cloudinary, una por entorno (`petcat-prod` en producción) |
| `ARCHIVOS_URL_VIGENCIA_MIN` | | `15` | Minutos de vigencia de las URLs firmadas de archivos privados |
| `EXPO_ACCESS_TOKEN` | | | Solo si el proyecto de Expo tiene activada la seguridad de push; sin ella las push se envían igual |

Cada variable nueva se agrega también a `backend/.env.example`.

### Correo

Los correos (verificación, recuperación de contraseña, invitaciones, bienvenida y avisos) salen por SMTP con Nodemailer. Lo que cambia entre desarrollo y un correo real son **solo variables de entorno**.

**Qué decide a dónde va el correo**

| Dónde corre la API | Qué manda | Por defecto |
|---|---|---|
| Docker (`backend`, `backend-demo`) | `MAIL_MODO` y `MAIL_MODO_DEMO` en el `.env` de la raíz | `mailpit`: todo llega a Mailpit, nada sale a internet |
| Host (`npm run dev`) | El SMTP de `backend/.env` | Sin `SMTP_HOST`, el correo se imprime en la consola |
| Tests | Nada: se guardan en memoria | — |

Cómo funciona en Docker: cada backend carga `backend/.env` y después `docker/correo/<modo>.env`. El modo `mailpit` reemplaza las variables SMTP por las de Mailpit (y deja vacíos usuario y contraseña); el modo `smtp` no define nada, así que manda el SMTP de `backend/.env`. Por eso Compose nunca pisa tu configuración real sin querer, y cada backend elige por separado: se puede tener la demo en Mailpit y `backend` con correo real al mismo tiempo. Valores válidos: `mailpit` y `smtp`. Otro valor hace fallar `docker compose up` con `env file docker/correo/<valor>.env not found`.

**Ver los correos en Mailpit**

Mailpit arranca con `docker compose up` (lo levantan los dos backends). Bandeja: **http://127.0.0.1:8025**. Ahí aparecen todos los correos de los backends en modo `mailpit`, con su versión HTML y sus enlaces, que abren el panel (`FRONTEND_URL`). Para usar Mailpit desde `npm run dev` en el host: `SMTP_HOST=localhost`, `SMTP_PORT=1025` y `SMTP_SECURE=none` en `backend/.env`.

**Probar la configuración**

```powershell
docker compose exec backend npm run mail:test -- --to tu_correo@ejemplo.com
docker compose exec backend-demo npm run mail:test -- --to tu_correo@ejemplo.com
cd backend; npm run mail:test -- --to tu_correo@ejemplo.com   # API en el host
```

Muestra la configuración (sin la contraseña), conecta, autentica y envía. Si falla, explica la causa: usuario o contraseña rechazados, servidor que no existe, puerto equivocado, tiempo de espera (`SMTP_TIMEOUT_MS`) o cifrado que no coincide con el puerto.

**Variables SMTP** (en `backend/.env`; ver la tabla de arriba)

- `SMTP_SECURE`: `tls` (TLS directo, puerto **465**), `starttls` (conecta y exige STARTTLS, puerto **587**) o `none` (sin cifrar, solo Mailpit u otro servidor local). Sin definir: 465 → `tls`; con usuario → `starttls`; sin usuario → `none`.
- `SMTP_USER` y `SMTP_PASS` van juntas. Sin ellas, el SMTP no usa autenticación.
- `SMTP_TIMEOUT_MS` (10 s): tiempo máximo para conectar, para el saludo y para cada operación.
- Las contraseñas SMTP solo van en `backend/.env`, que no se sube al repositorio.

**Paso a paso: Gmail con contraseña de aplicación** (para probar con correos reales)

1. En la cuenta de Google, activa la **verificación en dos pasos** (Cuenta de Google → Seguridad). Sin ella, Google no deja crear contraseñas de aplicación.
2. Crea una **contraseña de aplicación** en https://myaccount.google.com/apppasswords (por ejemplo, con el nombre "PetCat dev"). Google la muestra una sola vez: 16 letras.
3. En `backend/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=starttls
   SMTP_USER=tu_cuenta@gmail.com
   SMTP_PASS=la_contraseña_de_aplicacion_sin_espacios
   MAIL_FROM="PetCat <tu_cuenta@gmail.com>"
   ```
   Gmail solo envía como la cuenta autenticada: `MAIL_FROM` debe usar esa dirección.
4. En el `.env` de la raíz, pon en `smtp` el backend que quieras con correo real (por ejemplo `MAIL_MODO=smtp` y `MAIL_MODO_DEMO=mailpit`).
5. **Recrea el contenedor**: nodemon recarga el código, pero no vuelve a leer los `.env`.
   ```powershell
   docker compose up -d --force-recreate backend
   ```
   (con el modo desarrollo: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate backend`).
6. Prueba: `docker compose exec backend npm run mail:test -- --to tu_correo@ejemplo.com`.

Gmail limita los envíos diarios y no sirve para producción: úsalo solo para probar.

**Advertencia: los correos del seed no existen.** Los usuarios de prueba usan `@petcat.test` (`propietario@petcat.test`, `cliente@petcat.test`...), un dominio reservado que no recibe correo. Con SMTP real, cualquier envío a ellos rebota, y muchos rebotes dañan la reputación de la cuenta que envía. Con correo real, prueba con cuentas creadas con tu propio correo, o deja ese backend en Mailpit.

**En producción**

- Un proveedor de correo transaccional (Amazon SES, Brevo, Postmark, Mailgun, SendGrid...), no una cuenta personal: dan cuotas altas, métricas de rebotes y reputación separada.
- Un dominio propio verificado en el proveedor, con **SPF** (registro TXT que autoriza al proveedor a enviar por el dominio) y **DKIM** (firma de los correos con la clave que da el proveedor). Conviene también **DMARC**. Sin esto, los correos de verificación y recuperación caen en spam o los rechazan.
- `MAIL_FROM` con ese dominio (por ejemplo `PetCat <no-reply@petcat.co>`), `SMTP_SECURE=tls` o `starttls` según el puerto del proveedor, y credenciales SMTP del proveedor en las variables de entorno del servidor (nunca en el repositorio).
- `FRONTEND_URL` con la URL pública del panel: es la base de todos los enlaces de los correos.

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

`database/seeds/dev_seed.sql` carga datos realistas para diseñar el panel y la app, con los usuarios de la [sección 6](#usuarios-de-prueba). Se carga solo con un volumen nuevo de compose o con `db:reset`. **Las fechas son relativas al día en que se carga** (citas "hace 15 días", "en 3 días"...), así que un `db:reset` deja la agenda vigente otra vez. Las citas futuras caen en días en que abre su sucursal.

**Negocios** (todos en Sincelejo, con coordenadas y reseñas):

| Negocio | Tipo y plan | Qué sirve para ver |
|---|---|---|
| Clínica Veterinaria Patitas (Centro) | veterinaria, Gratuito | Horario partido; "Vacuna antirrábica" con oferta vigente; "Baño y corte" sin empleados (no reservable); bloqueo de Carlos una tarde; recepcionista con invitación pendiente. **Semana de agenda** (panel P4): de 3 días antes a 5 días después de hoy, con Carlos y Paula (veterinaria sin cuenta; 3 de 3 empleados) atendiendo a veces a la misma hora, dos reservas de la app **por confirmar** con plazo y una cita **fuera de disponibilidad** por un bloqueo personal de Paula ("Cita médica personal", texto que solo ve quien tiene `configuracion.ver`). |
| Peluquería Canina Huellitas (Venecia) | peluquería, Gratuito | Rol propio "Estilista"; servicios con margen de 15 min; "Baño y corte premium" en oferta; "Spa felino" solo sábados; empleada sin cuenta. Calificación 3 (la reseña se editó después de la respuesta). |
| Guardería Patas Felices (Boston) | guardería, Gratuito | Lunes a viernes; servicios por día con cupo diario (`max_citas_dia` 8); "Adiestramiento básico" sin entrenador. Sin verificar. |
| Centro Veterinario Salud Animal 24h | clínica, **Pro en prueba**, destacado | Sede Norte (todos los días 7-21) y Sede Sur (horario partido); veterinaria con horario semanal por sede, vacaciones en unos 20 días y jornada especial el próximo domingo (también es recepcionista de Huellitas); urgencias con precio variable; "Desparasitación" con oferta **vencida**; "Hospitalización" sin cita. |

**Clientes y mascotas:**

- **Sofía** (`cliente@petcat.test`): Max (dos consultas en Patitas con evolución de peso y control pendiente; antirrábica **vencida**, parvovirus **próxima**, una dosis antigua subida por ella) y Luna (triple felina registrada por la dueña con comprobante). En Patitas tiene una inasistencia y una **cancelación tardía**; próximas: vacuna de Max (confirmada), consulta de Luna (pendiente) y un baño en Huellitas. El negocio le canceló otro baño.
- **Camilo** (`camilo@petcat.test`): Rocky (alérgico al pollo, **no comparte su historial**: cada negocio ve solo lo que registró; atendido en Patitas, Huellitas, la guardería y urgencias de Salud Animal) y Mía (spa el sábado, consulta en 2 días). Una cita de Rocky cae en las vacaciones de la veterinaria: la agenda la marca `fuera_de_disponibilidad`.
- **Valeria** (`valeria@petcat.test`, correo sin verificar): Copito (conejo; mixomatosis próxima en 5 días; una cita **reprogramada** con su nueva cita pendiente) y Nala (**fallecida**, con una cita antigua en la guardería).
- **Jorge** (`jorge@petcat.test`): cliente **sin app** registrado desde el panel de Salud Animal; Toby tiene una cita **en curso hoy** y una inasistencia.
- **Lorena** (`lorena@petcat.test`, usa la app) con Milo y Nina (alérgica a la penicilina), y **Pedro** (`pedro@petcat.test`, **sin app**, registrado desde el panel de Patitas) con Lucas: llenan la semana de agenda de Patitas sin cambiar los conteos de Sofía.

Hay citas en los siete estados (`pendiente`, `confirmada`, `en_curso`, `completada`, `cancelada`, `no_asistio`, `reprogramada`), pasadas y futuras.

**Fase 2** (planes, notificaciones, reseñas, dashboard y notas):

| Qué | Dónde | Para ver |
|---|---|---|
| Dashboard con estadísticas avanzadas | Salud Animal (Pro en prueba): 14 citas completadas repartidas en los últimos 90 días, con dos veterinarios y dos sedes | Tendencia, comparación, por empleado y sucursal, horas pico y recurrencia (`?desde=` de hasta 366 días) |
| Dashboard Gratuito | Patitas: dos citas **canceladas por el sistema** (nadie las confirmó) y sin confirmación automática | `citas_perdidas_por_no_confirmar` con la sugerencia, y las secciones avanzadas bloqueadas con `plan_requerido` |
| Negocio cerca de sus límites | Guardería: 3 de 3 empleados (Diego, Sara y Tomás, sin cuenta) y unas 25 de 30 citas del mes con cinco perros de tres clientes sin app (Andrea, Luis y Marta) | `GET /negocios/:id/suscripcion`, el aviso `plan_limite_80` sin leer y, al reservar un par de citas más, el límite alcanzado |
| Reseñas | Patitas **respondió** la de Sofía; Camilo **editó la suya después de la respuesta** en Huellitas (bajó a 3); Valeria dejó 2 estrellas en Salud Animal y el negocio la **reportó** (sigue publicada); Jorge, registrado desde el panel, reseñó Salud Animal | `editada_despues_de_respuesta`, reporte en el panel y `cliente_registrado_por_negocio` (solo con `admin@petcat.test`) |
| Reseñar desde la app | Camilo: consulta de Mía **completada hoy** a las 07:45, con la invitación `resena_invitacion` programada a las 10:45; Sofía: consulta de Max de hace 15 días sin reseña | `resena.puede_resenar` en la cita y la invitación (el job la envía si el servidor corre después de las 10:45) |
| Notificaciones | Sofía (una leída, una sin leer), Laura de Patitas (cita nueva sin leer y dos citas no confirmadas), Natalia de la guardería (80 % del plan), Julián de Huellitas (reseña nueva) y Camilo (respuesta a su reseña) | Globo de no leídas y deep links (`datos`) |
| Dispositivos | Sofía (Android) y Camilo (iPhone), con tokens de Expo **inventados** | Lista de dispositivos; si el servidor intenta una push real, Expo los da de baja (`DeviceNotRegistered`) |
| Notas de clientes | Salud Animal sobre Jorge (de Ricardo) y sobre Camilo (de Valentina); la guardería sobre Andrea | Autor, `editable` y que Patitas no ve las notas de Salud Animal sobre Camilo |

### Reiniciar la base

```powershell
npm run db:reset -- --yes            # BORRA la base de backend/.env y la recrea con esquema + seed
npm run db:reset -- --yes --sin-seed # solo el esquema
```

Para una base de pruebas aparte que no toque esta, ver [Base de demo](#base-de-demo-para-probar-el-panel-web).

Se niega a correr con `NODE_ENV=production` o sin `--yes`.

### Base de demo (para probar el panel web)

`petcat_demo` es una base aparte con el esquema y el seed de desarrollo, para probar el panel web (y sus pruebas de Playwright) contra datos conocidos sin tocar `petcat_db`. Usa el mismo MySQL y el resto de `backend/.env` (credenciales, JWT, SMTP); solo cambia el nombre de la base.

En Docker la sirve el servicio `backend-demo` (ver [Dos backends en Docker](#dos-backends-en-docker-desarrollo-y-demo-del-panel)). Sin Docker, desde `backend/`:

```powershell
npm run db:demo     # BORRA y recrea petcat_demo con esquema + seed (no pide --yes: es solo para pruebas)
npm run dev:demo    # API con nodemon en http://localhost:3000, contra petcat_demo
```

- Como el seed usa fechas relativas al día en que se carga, `npm run db:demo` vuelve a dejar la agenda vigente.
- `dev:demo` y `npm run dev` usan el mismo puerto: corre uno a la vez (y detén el contenedor `backend`, como con `npm run dev`). Para tenerlos a la vez, cambia el puerto de uno: `$env:PORT=3001; npm run dev:demo`.
- `db:migrate` no aplica a `petcat_demo`: cuando haya una migración nueva, se recrea con `npm run db:demo`, porque `petcat.sql` ya la trae.

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
- **Campos requeridos en las respuestas:** en las respuestas 2xx, todo campo documentado se marca como requerido al generar la especificación (`marcarRequeridos` en `src/docs/swagger.js`), porque la API lo envía siempre (con `null` si no tiene valor). Un campo que puede faltar se marca en su YAML con `x-opcional: true` y se dice cuándo viene (por ejemplo `notas_internas`, solo en el panel). Los request bodies conservan su propio `required`. Así los tipos generados desde `docs.json` (panel y app) no quedan con todo opcional.
- **Contrato en los tests:** el cliente `api()` de los tests compara cada respuesta 2xx con su esquema de Swagger (`tests/helpers/contrato.js`) y falla si falta un campo requerido o si la respuesta no está documentada. Si un test falla con "Contrato: …", o la API dejó de enviar el campo o hay que marcarlo `x-opcional` en la documentación. Para revisar todo de una vez sin que fallen: `$env:CONTRATO_INFORME="contrato.tsv"; npm test`.
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
7. Si `GET /auth/me` trae `requiere_aceptar_politica: true` (cuenta sin autorización de datos para la versión vigente de la política), mostrar la política y enviar `POST /auth/politica-datos/aceptar` con `{ "acepta_politica_datos": true }`. `politica { version, url }` trae la versión vigente y el enlace al texto completo (`url` es null mientras PetCat no lo configure en `configuracion_global.politica_datos_url`).

Registro: `POST /auth/register` con `nombre`, `apellido`, `email`, `password` (8 a 72 caracteres, con letra y número), `acepta_politica_datos: true` (obligatorio: autorización de tratamiento de datos, Ley 1581 de 2012; la app debe mostrar la política y un check sin marcar) y opcionales `telefono`, `tipo_usuario` (`cliente` o `negocio`) y `canal` (`app` por defecto; el panel web envía `panel_web`). No inicia sesión. Si el email ya existe (también cuando un negocio registró a esa persona desde el panel), el 409 sugiere usar "Olvidé mi contraseña". Envía un correo de verificación; el email sin verificar no impide iniciar sesión ni reservar.

Canales de la autorización de datos (`autorizaciones_datos.canal`): `app` (registro en la app), `panel_web` (registro propio en el panel web), `panel` (un negocio registró al cliente; lleva `id_negocio`), `invitacion` (cuenta creada al aceptar una invitación de empleado) y `aceptacion` (cuenta existente que aceptó la versión vigente). `/auth/me` trae la última en `politica_aceptada`.

Pantallas del frontend que abren los enlaces de los correos (el token va en la ruta):

| Enlace | Qué hace la pantalla |
|---|---|
| `${FRONTEND_URL}/verificar-email/<token>` | Llama a `GET /auth/verify-email/:token` y muestra el resultado (400 = enlace vencido o ya usado). Reenviar el correo: `POST /auth/resend-verification` con la sesión iniciada, o `POST /auth/request-verification` con el email y sin sesión (respuesta neutra). |
| `${FRONTEND_URL}/restablecer-password/<token>` | Pide la contraseña nueva y envía `POST /auth/reset-password` con `{ "token", "password" }`. Luego, login. El enlace se pide con `POST /auth/forgot-password` (vigente 1 hora). |
| `${FRONTEND_URL}/crear-password/<token>` | Igual que la anterior, con otro texto ("Crea tu contraseña"): llega en el correo de bienvenida a un cliente que registró un negocio (vigente 7 días). Usa el mismo `POST /auth/reset-password`. |

### Acceso al panel de un negocio

- El acceso se decide por **pertenencia**, no por `tipo_usuario`: el usuario es propietario del negocio o empleado activo con su cuenta vinculada. Cualquier usuario puede crear un negocio (`POST /negocios`).
- `GET /negocios/mios` (y `negocios` en `GET /auth/me`) devuelve los negocios a los que el usuario puede entrar, con `relacion` (`propietario` o `empleado`), su `rol` con `permisos_json` y el `plan`. Úsalo para el selector de negocio del panel y para mostrar u ocultar secciones según los permisos (el propietario, con `rol: null`, tiene todos). La API decide igual en cada ruta: maneja siempre el 403.
- Los empleados tienen permisos por rol (`{ modulo: [acciones] }`); el catálogo completo está en `GET /permisos`. Un 403 dice qué falta.
- Invitaciones de empleados: el panel envía la invitación y el empleado recibe el enlace `${FRONTEND_URL}/invitacion/<token>`. La pantalla de ese enlace consulta `GET /invitaciones/:token` (dice si la cuenta ya existe y, con `requiere_aceptar_politica`, si hay que pedir la autorización de datos) y acepta con `POST /invitaciones/:token/aceptar`, que devuelve la sesión igual que el login. Si se crea una cuenta nueva, el body lleva `acepta_politica_datos: true`.

### Endpoints actuales

Detalle de cada uno en Swagger.

| Módulo | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh-token`, `GET` y `PATCH /auth/me`, `POST /auth/politica-datos/aceptar`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/verify-email/:token`, `POST /auth/resend-verification`, `POST /auth/request-verification` (sin sesión), `GET /politica-datos` (público) |
| Negocios | `POST /negocios`, `GET /negocios/mios`, `GET /negocios/:id_negocio` (público), `GET /negocios/:id_negocio/gestion` (panel), `PATCH /negocios/:id_negocio` |
| Sucursales | `GET` (público) y `POST /negocios/:id_negocio/sucursales`, `GET` (público), `PATCH` y `DELETE /sucursales/:id_sucursal` |
| Horarios | `GET` (público) y `PUT /sucursales/:id_sucursal/horarios` |
| Roles y permisos | `GET /permisos`, `GET` y `POST /negocios/:id_negocio/roles`, `PATCH` y `DELETE /roles/:id_rol` |
| Empleados | `GET` (paginado) y `POST /negocios/:id_negocio/empleados`, `POST /negocios/:id_negocio/empleados/yo`, `GET`, `PATCH` y `DELETE /empleados/:id_empleado`, `PATCH /empleados/:id_empleado/reactivar` |
| Invitaciones | `POST /empleados/:id_empleado/invitacion`, `POST /empleados/:id_empleado/invitacion/reenviar`, `GET /invitaciones/:token` (público), `POST /invitaciones/:token/aceptar` (público) |
| Mascotas (app) | `GET` y `POST /mascotas` (del usuario autenticado), `GET`, `PATCH` y `DELETE /mascotas/:id_mascota` |
| Servicios | `GET /categorias-servicio` (público), `GET` (paginado) y `POST /negocios/:id_negocio/servicios`, `GET /servicios/:id_servicio` (público), `PATCH` y `DELETE /servicios/:id_servicio`, `PATCH /servicios/:id_servicio/reactivar` |
| Búsqueda (app) | `GET /negocios` y `GET /servicios` (públicos, paginados) |
| Disponibilidad | `GET` y `POST /empleados/:id_empleado/disponibilidad`, `PUT /empleados/:id_empleado/horario-semanal`, `GET /empleados/:id_empleado/disponibilidad-efectiva`, `PATCH` y `DELETE /disponibilidad/:id_disponibilidad` |
| Citas | `GET /citas/horarios-libres` (público), `POST /citas` y `GET /citas/mias` (app), `GET /citas/:id_cita`, `POST /citas/:id_cita/cancelar`, `POST /citas/:id_cita/reprogramar` y `GET /citas/:id_cita/historial` (dueño o negocio), `PATCH /citas/:id_cita` y `PATCH /citas/:id_cita/estado` (panel), `GET /negocios/:id_negocio/citas/horarios-libres`, `GET` (agenda) y `POST /negocios/:id_negocio/citas` (panel) |
| Clientes (panel) | `GET` (listado) y `POST /negocios/:id_negocio/clientes`, `GET /negocios/:id_negocio/clientes/buscar`, `GET /negocios/:id_negocio/clientes/:id_usuario` (detalle), `GET /negocios/:id_negocio/clientes/:id_usuario/citas`, `POST /negocios/:id_negocio/clientes/:id_usuario/mascotas`, `GET` y `POST /negocios/:id_negocio/clientes/:id_usuario/notas`, `PATCH` y `DELETE /notas-cliente/:id_nota` |
| Dashboard (panel) | `GET /negocios/:id_negocio/dashboard` |
| Historial médico | `GET /mascotas/:id_mascota/historial` (dueño), `GET /negocios/:id_negocio/mascotas/:id_mascota/historial`, `POST /negocios/:id_negocio/historial`, `PATCH /historial/:id_historial` (panel) |
| Vacunas | `GET` y `POST /mascotas/:id_mascota/vacunas` (dueño), `GET /negocios/:id_negocio/mascotas/:id_mascota/vacunas`, `POST /negocios/:id_negocio/vacunas` (panel), `PATCH /vacunas/:id_vacuna` (quien la registró) |
| Resumen de salud | `GET /mascotas/:id_mascota/resumen-salud` (dueño) y `GET /negocios/:id_negocio/mascotas/:id_mascota/resumen-salud` (panel) |
| Reseñas | `POST /citas/:id_cita/resena`, `GET /resenas/mias`, `PUT` y `DELETE /resenas/:id_resena` (app, el autor), `GET /negocios/:id_negocio/resenas` (público), `GET /negocios/:id_negocio/resenas/gestion`, `PUT` y `DELETE /resenas/:id_resena/respuesta`, `POST /resenas/:id_resena/reportar` (panel) |
| Notificaciones | `GET /notificaciones`, `GET /notificaciones/no-leidas`, `PATCH /notificaciones/:id_notificacion/leida`, `POST /notificaciones/leer-todas`, `POST` y `DELETE /dispositivos` (app), `GET` y `POST /correo/baja` (públicos, enlace de los correos) |

### Disponibilidad de empleados

- **Horario semanal** (`PUT .../horario-semanal`, la semana completa en un solo guardado). Si un empleado no tiene horario semanal, sigue el de la sucursal; en cuanto se le carga uno, solo trabaja en esos rangos. Un rango sin `id_sucursal` vale para cualquier sucursal.
- **Excepciones** (`POST .../disponibilidad`): `bloqueo` (con o sin horas, uno o varios días), `vacacion` (días completos) y `evento_especial` (un día, en una sucursal, que **suma** horas, incluso fuera del horario de la sucursal). Para que un día quede solo con el evento, se combina con un bloqueo **con horas** sobre el horario normal: un bloqueo de día completo también quita el evento.
- `GET .../disponibilidad-efectiva?fecha=` devuelve los rangos resultantes por sucursal; sirve para pintar el calendario del empleado.
- Toda escritura responde `data.citas_afectadas`: citas futuras pendientes o confirmadas que ya no caben en la disponibilidad del empleado. El cambio se guarda igual; el panel debe mostrarlas para reprogramarlas o reasignarlas.

### Reservar citas

- **App:** `GET /citas/horarios-libres?id_servicio&id_sucursal&fecha[&id_empleado]` (público) y luego `POST /citas` con el `hora_inicio` elegido. Los horarios son de 15 en 15 minutos y con al menos 1 hora de anticipación, hasta 60 días adelante. Si no hay, la lista viene vacía con `motivo_sin_horarios` para mostrarlo. La cita queda `pendiente` hasta que el negocio la confirme (ver "Confirmación de citas").
- **Panel:** mismos pasos con `/negocios/:id_negocio/citas/horarios-libres` y `POST /negocios/:id_negocio/citas` (lleva `id_usuario` del cliente y `origen`); permite servicios ocultos en la app y horarios desde ahora. La cita queda `confirmada`.
- Sin `id_empleado`, cada horario lista quién puede atenderlo y la reserva se asigna al que tenga menos citas ese día.
- Un 409 al reservar ("El horario ya no está disponible") significa que otra persona lo tomó: volver a pedir los horarios libres.
- **Mis citas (app):** `GET /citas/mias?alcance=proximas|pasadas|todas`. Cada cita trae `negocio { id_negocio, nombre, logo_url }` y `sucursal { nombre, direccion, telefono, latitud, longitud }` para mostrar dónde es y ofrecer "Cómo llegar". El dueño nunca recibe `notas_internas`.
- **Agenda (panel):** `GET /negocios/:id_negocio/citas?desde&hasta` (por defecto hoy; máximo 31 días; sin paginar). `solo_mias=true` muestra solo las citas de quien consulta como empleado. Las citas con `fuera_de_disponibilidad: true` hay que reprogramarlas o reasignarlas (`fuera_de_disponibilidad=true` las lista).
- **Detalle:** `GET /citas/:id_cita` sirve para la app (dueño) y el panel (con notas internas).
- **Cambios:** el panel confirma, inicia, completa o marca inasistencia con `PATCH /citas/:id_cita/estado` y edita notas, prioridad, precio final o empleado con `PATCH /citas/:id_cita`. Dueño y negocio cancelan con `POST /citas/:id_cita/cancelar` (el negocio con motivo; si el dueño cancela a menos de 2 horas, `cancelacion.tardia: true`) y reprograman con `POST /citas/:id_cita/reprogramar` (el dueño hasta 2 horas antes; devuelve la cita nueva). `GET /citas/:id_cita/historial` muestra los cambios.
- **Inasistencias:** el detalle de la cita en el panel trae `cliente.historial_cumplimiento` (completadas, inasistencias y cancelaciones tardías del cliente en ese negocio).
- `PUT /sucursales/:id_sucursal/horarios` y `DELETE /empleados/:id_empleado` también responden `citas_afectadas`.

### Confirmación de citas

- **Plazo:** una cita pendiente trae `confirmar_antes_de`: hasta cuándo puede confirmarla el negocio. Es lo que ocurra primero entre 24 horas después de reservar y 60 minutos antes del inicio; si cae de madrugada (horario de silencio), se corre a las 08:00, sin pasar de 30 minutos antes del inicio. La app puede mostrar "el negocio tiene hasta las 3:00 p. m. para confirmar"; el panel, cuánto falta.
- **Aviso a mitad del plazo** (`cita_por_confirmar`): al propietario y a quien tiene `citas.editar`. Nunca suena de madrugada: sigue el horario de silencio.
- **Cancelación automática:** si nadie la confirma, al vencer el plazo la cita pasa a `cancelada` con `cancelacion.por = "sistema"`. Nunca es tardía ni cuenta contra el cliente (`historial_cumplimiento`), y en el historial de la cita aparece como `realizado_por: "sistema"`.
- **Reservar de nuevo (app):** el aviso `cita_no_confirmada` al dueño trae en `datos` `id_negocio`, `id_sucursal`, `id_servicio` e `id_mascota`. Con ellos, la app abre la reserva ya armada: `GET /citas/horarios-libres?id_servicio&id_sucursal&fecha` y `POST /citas` con esa mascota.
- **Confirmación automática:** con `confirmacion_automatica: true` (`PATCH /negocios/:id_negocio`, permiso `configuracion.editar`) las citas de la app y las que reprograma el dueño nacen `confirmada` (mensaje "Cita confirmada"), sin plazo y con sus recordatorios. El perfil público del negocio trae el mismo campo, para que la app muestre "confirmación inmediata". Activarla no confirma las pendientes que ya existen.

### Reseñas

- **Cuándo reseñar (app):** en `GET /citas/mias` y `GET /citas/:id_cita`, cada cita completada trae `resena { id_resena, retirada, resenar_antes_de, puede_resenar, puede_editar }` (null en las demás). Con `puede_resenar`, el botón "Reseñar" abre `POST /citas/:id_cita/resena`; con `puede_editar`, "Editar reseña" usa `PUT /resenas/:id_resena`. El plazo es de 30 días desde que se completó la cita, para reseñar y para editar.
- **Invitación:** 3 horas después de completada la cita, el dueño recibe `resena_invitacion` (push y app, sin correo). Si esa hora cae entre las 20:00 y las 10:00, llega a las 10:00. Sale una sola vez y no sale si ya reseñó.
- **Quién no puede:** el propietario y los empleados activos del negocio (403). Una reseña por cita; retirarla (`DELETE /resenas/:id_resena`) la quita de la calificación y no permite reseñar esa cita otra vez.
- **Body:** `calificacion` (1 a 5, obligatoria), `titulo`, `comentario` y `aspectos { atencion, precio, instalaciones, puntualidad }` opcionales. Editar reemplaza la reseña completa.
- **Perfil del negocio (app):** `GET /negocios/:id_negocio/resenas?orden=recientes|mejores|peores&calificacion=` (público, paginado). El autor viene como "Sofía G." y la visita solo con mes y año (`visita_verificada`); nunca datos de contacto. `meta.resumen` trae el promedio, el total y la `distribucion` por estrellas para el gráfico. El perfil (`GET /negocios/:id_negocio`) trae las 5 más recientes con el mismo formato.
- **Respuesta:** `respuesta { texto, fecha, editada }` o null. Si el autor editó la reseña después de la última respuesta, `editada_despues_de_respuesta: true`: la app puede indicarlo para que la respuesta no quede fuera de contexto.
- **Panel:** `GET /negocios/:id_negocio/resenas/gestion` (`resenas.ver`; filtros `sin_responder`, `reportada`, `visible`, `calificacion`) con el nombre completo del cliente, la cita y el reporte. Responder (`PUT /resenas/:id_resena/respuesta`) y borrar la respuesta piden `resenas.responder`, porque la respuesta es pública y habla por el negocio; el dueño recibe `resena_respondida` solo la primera vez. Los roles del sistema: Administrador con `ver`, `responder` y `reportar`; Veterinario y Recepcionista solo `ver`. Los roles propios del negocio hay que editarlos para darles el módulo.
- **Reportar:** `POST /resenas/:id_resena/reportar` (`resenas.reportar`) con `motivo` (`lenguaje_ofensivo`, `datos_personales`, `no_relacionada`, `spam`, `otro`; con `otro`, `detalle` obligatorio). Una vez por reseña. **La reseña sigue publicada y contando en la calificación** hasta que la revise PetCat: el panel debe decirlo al reportar ("PetCat la revisará") para no dar a entender que se oculta. Una reseña que PetCat oculta aparece en el panel con `visible: false`.

### Salud de la mascota

- El dueño ve el historial y las vacunas de sus mascotas en `/mascotas/:id_mascota/...` (sin notas internas). El panel usa `/negocios/:id_negocio/mascotas/:id_mascota/...` y solo funciona si la mascota tiene una cita con ese negocio que no esté cancelada ni reprogramada (403 si no).
- `compartir_historial` (en `PATCH /mascotas/:id_mascota`, por defecto true): con false, cada negocio ve solo el historial clínico que él creó. Las **vacunas**, las alergias y las condiciones médicas siempre las ve cualquier negocio con cita.
- En el carnet, `registrada_por: dueno` y `tiene_comprobante` distinguen las vacunas que registró el dueño de las de un profesional. `estado` ya viene calculado (`no_aplica` en dosis reemplazadas por una más reciente de la misma vacuna).
- Los archivos del historial y el comprobante de una vacuna se suben aparte (ver "Archivos e imágenes") y llegan en `archivos` y `comprobante` con URL firmada que vence.
- `resumen-salud` trae lo que la app necesita para la ficha: vacunas vencidas y próximas (30 días), último y próximo control, próxima cita y evolución del peso.

### Clientes sin app (panel)

1. Buscar por email o teléfono exactos: `GET /negocios/:id_negocio/clientes/buscar?email=` o `?telefono=` (hasta 5 resultados con sus mascotas). Tiene el límite estricto de solicitudes.
2. Si no existe, registrarlo: `POST /negocios/:id_negocio/clientes` con sus datos, su primera mascota y `autoriza_tratamiento_datos: true`. El panel debe pedir y registrar esa autorización al cliente (Ley 1581 de 2012). El cliente recibe un correo con el nombre del negocio y un enlace de 7 días para crear su contraseña.
3. Si ya es cliente del negocio (tiene una cita con él o el negocio lo registró) y trae otra mascota: `POST /negocios/:id_negocio/clientes/:id_usuario/mascotas`.
4. Agendar con `POST /negocios/:id_negocio/citas`.

La sección de clientes del panel usa `GET /negocios/:id_negocio/clientes` (con `inasistencias` por fila para mostrar una alerta) y `GET /negocios/:id_negocio/clientes/:id_usuario` (contacto, cumplimiento, mascotas, citas y las 3 últimas notas; todo solo con ese negocio).

### Notas de clientes (panel)

- Notas internas del negocio sobre un cliente: `GET` (con `clientes.ver`) y `POST` (con `clientes.editar`) `/negocios/:id_negocio/clientes/:id_usuario/notas`; `PATCH` y `DELETE /notas-cliente/:id_nota`. Cada nota trae `autor` (null si su cuenta ya no existe: mostrar "Ex miembro del equipo"), `fecha_creacion`, `fecha_edicion`, `editable` y `eliminable` para mostrar u ocultar los botones: edita solo el autor; borra el autor o el propietario. Borrar es definitivo.
- Solo las ve el negocio que las escribió: nunca el cliente (en la app) ni otro negocio, aunque atienda al mismo cliente.
- **Qué escribir (conviene mostrarlo junto al campo):** solo lo útil para atender mejor al cliente, por ejemplo "prefiere que lo llamen en la tarde" o "el perro se estresa con la secadora". **No escribir** diagnósticos ni tratamientos (van en el historial médico), datos de salud del cliente, datos financieros ni opiniones personales. La nota es un dato personal del cliente: por la Ley 1581 de 2012 puede pedir conocer lo que el negocio guarda sobre él. Regla práctica: escribe solo lo que no te incomodaría que el cliente leyera.

### Dashboard (panel)

- `GET /negocios/:id_negocio/dashboard?desde&hasta&id_sucursal` con `reportes.ver` (el propietario y el rol Administrador). Por defecto, los últimos 30 días hasta hoy; `hasta` no puede ser futuro. Rango máximo: **92 días en Gratuito y 366 en Pro y Enterprise**. Si un Gratuito pide más, responde 422 con `errors.plan_requerido: "Pro"`: el panel puede mostrarlo como invitación a mejorar el plan.
- **Básico (todos los planes):** `hoy` (citas de hoy por estado y `por_confirmar`), `citas` por estado, `tasa_inasistencia`, `ingresos`, `servicios_mas_pedidos`, `clientes_nuevos`, `calificacion` (con `sin_responder`) y `citas_perdidas_por_no_confirmar`.
- **Ingresos:** son los **registrados** por el negocio al completar cada cita (`precio_final`), no pagos verificados: la respuesta trae `verificado: false` y una `nota`. El panel debe rotularlos así ("Ingresos registrados") hasta que lleguen los pagos en la Fase 3.
- **Citas perdidas por no confirmar:** las que se cancelaron solas porque nadie las confirmó a tiempo. Nunca cuentan contra los clientes. Si hubo alguna y la confirmación automática está apagada, `sugerencia` trae un mensaje para mostrar con un botón que lleve a activarla (`PATCH /negocios/:id_negocio` con `confirmacion_automatica: true`).
- **Avanzado** (`avanzadas`: tendencia, comparación con el periodo anterior, por empleado, por sucursal, horas pico, recurrencia y cancelaciones): con el plan Pro, Enterprise o la prueba Pro. En Gratuito cada sección llega como `{ bloqueado: true, plan_requerido: { nombre, precio_mensual } }`, sin datos: el panel dibuja la tarjeta como invitación. Si `prueba_disponible` es true, conviene ofrecer "Probar Pro 14 días" (`POST /negocios/:id_negocio/suscripcion/prueba-pro`) en lugar de "Mejorar plan".
- La tendencia agrupa por día hasta 31 días, por semana (desde el lunes) hasta 92 y por mes en rangos mayores; los intervalos sin citas vienen en cero.

### Servicios y búsqueda

- Cada servicio tiene sus **empleados asignados** (`empleados: [id_empleado]` en el body de crear y editar; al editar reemplaza el conjunto). En el listado del panel, `sin_empleados: true` avisa que el servicio no se puede reservar: conviene mostrar una alerta para que el negocio asigne a alguien. El detalle de un empleado (`GET /empleados/:id_empleado`) trae los `servicios` que atiende.
- En la app, los servicios no reservables se muestran igual con `reservable: false` (deshabilitar el botón de reservar). `precio_actual` ya tiene en cuenta la oferta vigente.
- `indicaciones_previas` (opcional, hasta 500 caracteres): cómo preparar la cita (ayuno, carnet de vacunas, transporte). El panel la edita en el formulario del servicio; la app puede mostrarla antes de reservar, y va en el recordatorio del día anterior.
- `GET /negocios` y `GET /servicios` aceptan `lat`, `lng` y `radio_km` (por defecto 10 km, máximo 50). **Con coordenadas, los negocios que no tienen coordenadas en ninguna sucursal activa ni en el negocio quedan fuera de los resultados.** El panel debería pedir la ubicación al crear una sucursal y avisar al negocio si ninguna la tiene, porque sin ella no aparece en "cerca de mí". La distancia (`distancia_km`) es la de la sucursal más cercana (`sucursal_cercana`).
- Los textos de búsqueda (`q`) no distinguen tildes ni mayúsculas: "bano" encuentra "Baño".

### Archivos e imágenes

Las fotos, logos, banners, comprobantes de vacunas y archivos del historial se suben a la API como `multipart/form-data` (nunca como URL en el JSON). La API valida el tipo real por el contenido, quita los metadatos de las imágenes (incluida la ubicación GPS de la cámara) y las guarda en Cloudinary. Rutas (detalle en Swagger):

| Ruta | Campo | Quién |
|---|---|---|
| `PUT`/`DELETE /auth/me/foto` | `foto` | El usuario |
| `PUT`/`DELETE /mascotas/:id_mascota/foto` | `foto` | El dueño |
| `PUT`/`DELETE /empleados/:id_empleado/foto` | `foto` | `empleados.editar` o el propio empleado |
| `PUT`/`DELETE /negocios/:id_negocio/logo` y `/banner` | `logo` / `banner` | `configuracion.editar` |
| `PUT`/`DELETE /vacunas/:id_vacuna/comprobante` | `comprobante` | Quien puede editar la vacuna (la del dueño, el dueño; la de un negocio, ese negocio) |
| `POST /historial/:id_historial/archivos`, `DELETE /historial/:id_historial/archivos/:id_archivo` | `archivos` (hasta 5) | El negocio que creó el registro (`historial_medico.editar`) |

Todas responden el registro actualizado. Máximo 30 subidas cada 15 minutos por usuario (429).

- **Tipos:** JPEG, PNG o WebP; PDF solo en comprobantes y archivos del historial. Máximo 5 MB (fotos y logo), 8 MB (banner) y 10 MB (comprobantes e historial, hasta 5 archivos por envío). Un archivo inválido responde 422 con el detalle en `errors.archivo`.
- **Fotos del iPhone (HEIC) — app móvil:** la API **no acepta HEIC/HEIF** (422). La app debe convertir la imagen a JPEG antes de subirla, por ejemplo con `expo-image-manipulator`, que además sirve para reducirla y ahorrar datos:

  ```js
  import * as ImageManipulator from "expo-image-manipulator";

  const { uri } = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 2048 } }],            // la API no guarda más de 2048 px
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  const form = new FormData();
  form.append("foto", { uri, name: "foto.jpg", type: "image/jpeg" });
  ```
- **Imágenes públicas** (fotos de usuario, mascota y empleado, logo y banner): los campos `*_url` traen la versión mediana (800 px) y `*_miniatura_url` una miniatura cuadrada de 200 px para listas y avatares. Se sirven por la CDN y no vencen.
- **Archivos privados** (historial y comprobantes): llegan dentro del registro como `{ id_archivo, tipo, nombre, bytes, url, url_expira_en }`. La `url` es **firmada y vence** a los 15 minutos (`url_expira_en`, ISO 8601). No se guarda: cuando vence (o si al abrirla responde 401/403/404), la app vuelve a pedir el registro (por ejemplo `GET /mascotas/:id_mascota/historial` o `/vacunas`) y usa la URL nueva. Conviene pedirlo justo antes de abrir el archivo si la pantalla lleva un rato abierta. Solo recibe la URL quien puede ver ese registro.
- Reemplazar una imagen borra la anterior. Eliminar una mascota no borra sus archivos (el borrado es lógico).

### Notificaciones

Cada aviso llega por varios canales a la vez:

| Canal | Quién | Contenido |
|---|---|---|
| Notificación en la app/panel (`GET /notificaciones`) | Todos los destinatarios | Detalle completo (mascota, servicio, motivo) |
| Socket.IO (evento `notificacion`) | Quien tenga el panel o la app abiertos | Lo mismo, en tiempo real |
| Push de Expo | Usuarios con un dispositivo registrado y `notif_push` | Genérico (se ve en la pantalla bloqueada): tipo, fecha, hora y negocio |
| Correo | Solo si no tiene dispositivo y `notif_email`: el dueño en los avisos de sus citas y vacunas, y el **propietario** del negocio en `cita_nueva`, `resena_nueva`, `plan_prueba_por_vencer` y `plan_vencido` | Discreto, con sede y dirección, y enlace "Dejar de recibir estos correos" |

Tipos actuales y a quién llegan (`datos` para el deep link):

| Tipo | Cuándo | Para | `datos` |
|---|---|---|---|
| `cita_nueva` | Reserva desde la app (pendiente, o confirmada con la confirmación automática) | Negocio (`citas.ver`) | `id_cita`, `id_negocio` |
| `cita_agendada` | El panel agenda una cita | Dueño | `id_cita`, `id_negocio` |
| `cita_confirmada` | El negocio confirma | Dueño | `id_cita`, `id_negocio` |
| `cita_cancelada`, `cita_reprogramada` | Cancela o reprograma una parte | La otra parte | `id_cita`, `id_negocio` |
| `cita_dia_anterior` | 19:00 del día anterior a una cita confirmada | Dueño | `id_cita`, `id_negocio` |
| `cita_recordatorio` | 2 horas antes | Dueño | `id_cita`, `id_negocio` |
| `cita_por_confirmar` | A mitad del plazo para confirmar una cita pendiente | Negocio (`citas.editar`) | `id_cita`, `id_negocio` |
| `cita_no_confirmada` | El plazo venció y la cita se canceló sola | Dueño y negocio (`citas.ver`) | `id_cita`, `id_negocio`; al dueño también `id_sucursal`, `id_servicio`, `id_mascota` |
| `resena_invitacion` | 3 horas después de completada la cita (entre las 20:00 y las 10:00, a las 10:00) | Dueño (sin correo) | `id_cita`, `id_negocio` |
| `resena_nueva` | Un dueño reseña el negocio | Negocio (`resenas.responder`) | `id_cita`, `id_negocio`, `id_resena` |
| `resena_respondida` | El negocio responde por primera vez | Dueño | `id_cita`, `id_negocio`, `id_resena` |
| `vacuna_proxima`, `vacuna_vence_hoy`, `vacuna_vencida` | 7 días antes, el día y 7 días después de `fecha_proxima` (09:00) | Dueño | `id_mascota`, `id_vacuna` |
| `plan_limite_80`, `plan_limite_alcanzado` | 80 % del límite de citas del mes; reserva rechazada por el límite | Negocio (`configuracion.editar`) | `id_negocio`, `mes` |
| `plan_prueba_por_vencer` | A la prueba Pro le quedan 3 días o menos | Negocio (`configuracion.editar`) | `id_negocio` |
| `plan_vencido` | Terminó la prueba o venció el plan pago | Negocio (`configuracion.editar`) | `id_negocio` |

Del lado del negocio los reciben el propietario (siempre) y los empleados con el permiso indicado, nunca quien hizo la acción.

- **Globo de no leídas:** `GET /notificaciones/no-leidas` al abrir, `meta.no_leidas` en el listado, y luego sumar con cada evento `notificacion`. Marcar con `PATCH /notificaciones/:id_notificacion/leida` o `POST /notificaciones/leer-todas`.
- **Deep link:** `datos` trae el `tipo` y los ids de la tabla para abrir la pantalla correspondiente (la cita, el carnet de la mascota o la suscripción del negocio). Es lo mismo que llega en el `data` de la push, más `id_notificacion`.
- **Horario de silencio (21:00 a 07:00):** push y correos esperan hasta las 07:00, salvo la cancelación o reprogramación de una cita cercana y el recordatorio de 2 horas antes de una cita temprana (antes de las 10:00), que salen enseguida con prioridad alta. La notificación en la app y el evento de Socket.IO siempre son inmediatos.
- **Recordatorio del día anterior:** si el servicio tiene `indicaciones_previas` (ayuno, carnet...), el mensaje en la app y el correo las incluyen; la push no. Una cita agendada después de las 19:00 para el día siguiente no recibe este recordatorio.
- **Avisos del plan:** terminan con el contacto de soporte (`soporte_email` y `soporte_whatsapp` en `configuracion_global`; lo que esté vacío se omite). Las notificaciones se borran solas: las leídas a los 90 días y todas a los 180.

### Notificaciones en tiempo real (Socket.IO)

El servidor de Socket.IO corre en el mismo puerto de la API (ruta `/socket.io`, sin el prefijo `/api/v1`). Se usa `socket.io-client` v4 (panel web y app):

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {        // la URL del servidor, sin /api/v1
  auth: (cb) => cb({ token: getAccessToken() }),     // función: toma el token vigente en cada reconexión
});

socket.on("notificacion", (n) => {                   // misma forma que un elemento de GET /notificaciones
  agregarAlListado(n);
  sumarNoLeida();
});
socket.on("notificaciones_leidas", ({ no_leidas }) => actualizarGlobo(no_leidas)); // se marcaron desde otra sesión

socket.on("connect_error", async (err) => {
  // "Token expirado": renovar con POST /auth/refresh-token; socket.io reintenta solo con el token nuevo.
  if (err.message === "Token expirado") await renovarToken();
  // "Sesión inválida o expirada" o "Token inválido": la sesión se cerró; ir al login.
});
```

- El handshake valida el access token igual que las rutas protegidas. Una vez conectado, que el token venza **no** desconecta: lo que cuenta es la sesión.
- El servidor desconecta el socket al cerrar esa sesión (`POST /auth/logout`), al cambiar la contraseña (las demás sesiones) y al restablecerla (todas). Si el cliente recibe `disconnect` con motivo `"io server disconnect"`, no reconecta solo: tratarlo como sesión cerrada.
- Al reconectar después de un corte, volver a pedir `GET /notificaciones/no-leidas`: los eventos emitidos mientras estaba desconectado no se repiten.
- En el navegador, el origen del panel debe estar en `CORS_ORIGINS` (el mismo de la API). La app no envía `Origin`.
- Para probarlo sin frontend: conectar con el token de `POST /auth/login`, y desde Swagger, con otro usuario, reservar o cancelar una cita que le toque.

### Notificaciones push (app móvil) — guía para Daniel

La API envía las push por el servicio de Expo (`expo-server-sdk`); la app solo tiene que conseguir su token y registrarlo.

**1. Registrar el dispositivo después del login** (y cada vez que el token cambie):

```js
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

export async function registrarPush(api) {
  if (!Device.isDevice) return;                        // simuladores/emuladores no reciben push
  if (Platform.OS === "android") {
    // La API no envía channelId: Android usa el canal "default", que la app debe crear.
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token_expo } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post("/dispositivos", {
    token_expo,                                         // "ExponentPushToken[...]"
    plataforma: Platform.OS,                            // "ios" | "android"
    nombre: Device.modelName ?? undefined,
  });
}
```

- El dispositivo queda ligado a la **sesión**: al hacer logout la API lo desactiva sola (no hace falta llamar a `DELETE /dispositivos`). Tras un nuevo login hay que volver a registrarlo. `DELETE /dispositivos` es para cuando el usuario apaga las notificaciones dentro de la app.
- Si otra cuenta inicia sesión en el mismo teléfono, el token pasa a esa cuenta (responde 200 en vez de 201).
- Si Expo informa que el token ya no sirve (`DeviceNotRegistered`, app desinstalada o permisos retirados), la API lo desactiva. Registrarlo en cada inicio de la app evita perder push si el usuario vuelve a dar permiso.
- Con dispositivo activo el usuario deja de recibir correos de sus citas (recibe la push en su lugar).

**2. Abrir la pantalla al tocar la push.** El `data` trae `{ tipo, id_cita?, id_negocio?, mes?, id_notificacion }`:

```js
Notifications.addNotificationResponseReceivedListener(({ notification }) => {
  const { tipo, id_cita, id_notificacion } = notification.request.content.data;
  if (id_cita) navigation.navigate("DetalleCita", { id_cita });
  api.patch(`/notificaciones/${id_notificacion}/leida`);
});
```

El texto de la push es genérico a propósito (sin mascota ni motivo); el detalle se muestra con `GET /citas/:id_cita` o `GET /notificaciones`, que piden sesión.

**3. Probar push reales:**

1. **Development build, no Expo Go.** Desde el SDK 53, Expo Go no recibe push remotas en Android. Crear el proyecto en EAS (`npx eas init`, que deja el `projectId` en `app.json`) y generar una development build (`npx eas build --profile development --platform android`) para instalar en un teléfono físico.
2. **Credenciales:** Android necesita FCM V1: crear un proyecto en Firebase, poner `google-services.json` en la app y subir la clave de la cuenta de servicio en EAS (`npx eas credentials` → Android → Google Service Account Key for Push Notifications (FCM V1)). iOS necesita cuenta de Apple Developer (paga); en el MVP se prueba con Android.
3. **Probar sin la API:** con el token que imprime la app, enviar una push de prueba desde https://expo.dev/notifications. Si no llega aquí, el problema está en la app o las credenciales, no en la API.
4. **Probar con la API:** el teléfono y el PC en la misma red; la app apunta a `http://<IP-del-PC>:3000/api/v1` (desde el teléfono `localhost` es el propio teléfono; la IP sale de `ipconfig`, y el firewall de Windows debe permitir el puerto 3000). Iniciar sesión en la app como un cliente del seed (p. ej. `cliente@petcat.test`), registrar el dispositivo y, desde Swagger con `propietario@petcat.test`, confirmar, cancelar o reprogramar una cita de ese cliente en "Clínica Veterinaria Patitas". Fuera de Docker, `npm run dev` envía push reales (solo los tests usan un envío en memoria).
5. **De noche (21:00 a 07:00)** las push quedan programadas para las 07:00. Para probar a esa hora, desactivar el silencio en la base de desarrollo (inicio = fin) y volver a dejarlo como estaba al terminar:

   ```powershell
   "UPDATE configuracion_global SET valor = '00:00' WHERE clave IN ('silencio_inicio', 'silencio_fin');" | docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 petcat_db'
   ```

   (`npm run db:reset -- --yes` también lo restablece a 21:00 y 07:00.)
6. **Si no llega:** revisar la consola del backend (los errores de envío se registran y el envío queda para el job que corre cada minuto) y la tabla `notificaciones_envios` (`estado`, `error`). `EXPO_ACCESS_TOKEN` solo hace falta si se activa "Enhanced security for push" en el proyecto de Expo.

### Usuarios de prueba

Con el seed cargado, todos usan la contraseña **`Petcat123!`**:

| Email | Rol en los datos de ejemplo |
|---|---|
| `admin@petcat.test` | Super admin de la plataforma |
| `propietario@petcat.test` | Dueña de "Clínica Veterinaria Patitas" |
| `veterinario@petcat.test` | Empleado con rol Veterinario |
| `cliente@petcat.test` | Dueña de las mascotas Max y Luna |
| `huellitas@petcat.test` | Dueño de "Peluquería Canina Huellitas" |
| `guarderia@petcat.test` | Dueña de "Guardería Patas Felices" |
| `saludanimal@petcat.test` | Dueño de "Centro Veterinario Salud Animal 24h" (también atiende como empleado) |
| `vet.salud@petcat.test` | Veterinaria de Salud Animal (horario semanal, vacaciones y jornada especial) y recepcionista de Huellitas: entra a **dos negocios** (selector del panel) |
| `camilo@petcat.test` | Dueño de Rocky (no comparte historial) y Mía |
| `valeria@petcat.test` | Dueña de Copito y de Nala (fallecida); correo sin verificar |
| `jorge@petcat.test` | Cliente sin app registrado desde el panel de Salud Animal (dueño de Toby) |
| `andrea@petcat.test`, `luis@petcat.test`, `marta@petcat.test` | Clientes sin app de la guardería (Bruno y Kira; Simón y Lola; Coco) |
| `lorena@petcat.test` | Clienta de Patitas con la app (Milo y Nina) |
| `pedro@petcat.test` | Cliente sin app registrado desde el panel de Patitas (Lucas) |

El detalle de cada negocio y cliente está en la [sección 3](#seed-de-desarrollo).

Invitación pendiente de la recepcionista (`recepcionista@petcat.test`, sin cuenta), para probar la pantalla de aceptar:
`http://localhost:5173/invitacion/5eed000000000000000000000000000000000000000000000000000000000001`

### CORS y límites

- El navegador solo puede llamar a la API desde los orígenes de `CORS_ORIGINS` (por defecto `http://localhost:5173`, el de Vite). Si el panel corre en otro puerto, agrégalo en `backend/.env`.
- La app móvil no envía cabecera `Origin`, así que CORS no la afecta.
- Límite general: 300 solicitudes cada 15 minutos por IP (`RATE_LIMIT_MAX`). Login, forgot-password, reset-password, verify-email, resend-verification, request-verification e invitaciones tienen un límite más estricto (`AUTH_RATE_LIMIT_MAX`). Al superarlo: 429.
- En desarrollo, los correos (por ejemplo, las invitaciones) llegan a Mailpit: http://127.0.0.1:8025 (ver "Correo" en la sección 2). Con la API en el host y sin `SMTP_HOST`, se imprimen en su consola.
