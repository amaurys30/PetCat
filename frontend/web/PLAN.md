# PetCat · Panel web v1 — Plan de trabajo

Marca `[x]` al terminar cada tarea. Las convenciones están en `frontend/web/CLAUDE.md`. Los códigos (A1, B3…) son los nombres de las pantallas en el Figma.

Orden pensado para que cada fase deje datos listos para la siguiente: primero acceso y configuración (negocio, sedes, horarios, equipo, servicios), después la agenda, que depende de todo lo anterior.

---

## P0 — Cimientos

**Entorno**
- [x] Base de demo separada: `petcat_demo` con esquema y seed, sin tocar `petcat_db`. Script en el backend (por ejemplo `npm run db:demo`) y forma de levantar la API contra esa base (por ejemplo `npm run dev:demo`). Documentarlo en el README.
- [x] Crear el proyecto en `frontend/web` (Vite + React + TypeScript), ESLint, Prettier, alias `@/`.
- [x] Proxy de Vite a la API, `.env.example` (`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_MAPS_API_KEY` opcional) y `.env.local` en el `.gitignore`.
- [x] `npm run api:types` con openapi-typescript y primera generación de `schema.d.ts`.
- [x] Vitest + Testing Library; Playwright con un flujo de humo (login con el seed).
- [x] CI: agregar al workflow un job para `frontend/web` (typecheck, lint, tests, build).
- [x] Sección "Monorepo" en el `CLAUDE.md` de la raíz que remita a `frontend/web/CLAUDE.md`.

**Sistema de diseño** (Figma 00)
- [x] Tokens en Tailwind, fuente Inter, componentes shadcn adaptados: Button, Input, Select, Checkbox, Switch, Tabs, Badge, Card, Dialog, Sheet (panel lateral), Tooltip, Toast.
- [x] Comunes: PageHeader, EstadoCitaBadge, Avatar con iniciales, EmptyState, Skeleton, DataTable, Chips, PlanLimitDialog.
- [x] PanelLayout con Sidebar (selector de negocio, menú por grupos, tarjeta del plan, usuario) y Topbar (título, búsqueda, campana, avatar). AuthLayout con el panel de marca degradado.

**Infraestructura**
- [x] Cliente Axios: token, refresh con una sola promesa compartida, normalización de errores. Sesión compartida entre pestañas (BroadcastChannel) y una sola renovación a la vez (`navigator.locks`).
- [x] Stores de sesión y negocio activo; rutas protegidas; rutas `/n/:idNegocio/...`; helper `puede()`.
- [x] `lib/format.ts` (fechas, horas, dinero) con pruebas.

**Pantallas**
- [x] A1 Iniciar sesión (incluye cuenta bloqueada y credenciales inválidas)
- [x] A2 Recuperar contraseña · A3 Crear / restablecer contraseña
- [x] A5 Seleccionar negocio
- [x] A9 Aceptar política de datos (cuando `requiere_aceptar_politica`)
- [x] S1 Estados del sistema (sin permiso, no encontrado, vacío, carga, sin conexión, sesión vencida, límite del plan, avisos flotantes)

## P1 — Onboarding, perfil y configuración
- [x] A7 Crear cuenta · A8 Verificación de correo (y reenviar enlace)
- [x] A4 Aceptar invitación (cuenta nueva y existente; auto-login)
- [x] Componente de ubicación de sede: Google Maps con pin arrastrable y Places Autocomplete; sin clave, latitud y longitud manuales.
- [x] A6 / A6b / A6c Crear negocio: datos, sede principal con mapa, horarios con plantillas
- [x] E0 Perfil del negocio (resumen)
- [x] E1 Configuración del negocio: datos, logo, banner, confirmación automática
- [x] E2 Sedes y horarios: CRUD de sedes, ubicación, horario partido
- [x] E6 Mi perfil: datos, foto, cambio de contraseña, notificaciones, política

## P2 — Equipo
- [x] D3 Equipo: miembros, estado de la invitación, reenviar, desactivar y reactivar, "Agregarme como profesional"
- [x] D3b Agregar / editar miembro (rol, servicios que atiende, foto, enviar invitación)
- [x] D4 Roles y permisos (catálogo de `GET /permisos`, roles del sistema bloqueados, regla de escalada)
- [x] D5 Disponibilidad del profesional · D6 Nueva excepción (con `citas_afectadas`)

## P3 — Servicios
- [x] D1 Catálogo de servicios (reservable, sin profesionales, oferta)
- [x] D2 Formulario de servicio (especies, precios, oferta, margen, días, profesionales, indicaciones previas)

## P4 — Agenda y citas
Sub-bloques: P4.1 calendario y vistas · P4.2 detalle y acciones · P4.3 nueva cita · P4.4 tiempo real.

- [x] Componente de calendario propio (cuadrícula de 15 minutos, horario partido, línea de la hora actual, citas que se cruzan lado a lado; sin arrastrar y soltar) — P4.1
- [x] B3 Agenda semanal con el panel "Por confirmar" y "Fuera de disponibilidad" — P4.1 (las acciones de las tarjetas llegan en P4.2)
- [x] B9 Vista Día por profesional · B10 Vista Lista — P4.1
- [x] B4 Detalle de cita (panel lateral): datos, cumplimiento del cliente, notas internas, historial, plazo para confirmar — P4.2
- [x] B6 Cancelar · B7 Reprogramar · B8 Completar / No asistió · reasignar profesional; "Reasignar" y "Reprogramar" en el diálogo de citas afectadas — P4.2
- [ ] B5 Nueva cita: búsqueda de cliente, registro de cliente sin app (C3), horarios libres, origen — P4.3
- [ ] Actualizar la agenda con los eventos de Socket.IO — P4.4

## P5 — Clientes y salud
- [ ] C1 Clientes: lista, detalle, cumplimiento, notas privadas
- [ ] C3 Registrar cliente sin app · C6 Agregar mascota a un cliente
- [ ] C2 Ficha de la mascota: resumen de salud, historial, carnet de vacunas, archivos
- [ ] C4 Nuevo registro médico (con archivos) · C5 Nueva vacuna (con comprobante)

## P6 — Negocio y tiempo real
- [ ] B1 / B2 Dashboard (secciones bloqueadas en Gratuito, rango máximo por plan)
- [ ] E3 Reseñas: responder, reportar, filtros
- [ ] E4 Suscripción y planes (prueba Pro)
- [ ] E5 Notificaciones: desplegable, contador, marcar leídas, Socket.IO
- [ ] X1 Administración: asignar plan (solo `tipo_usuario = admin`)

## P7 — Cierre del panel v1
- [ ] Flujos de punta a punta con Playwright: login → elegir negocio → agendar → confirmar → completar → registro médico; invitar a un miembro; cliente sin app.
- [ ] Revisión contra el Figma pantalla por pantalla.
- [ ] Revisión de accesibilidad básica y de estados vacíos y de error.
- [ ] README del panel (cómo correrlo y probarlo) y PR a `main`.

---

## Pendientes de API
_(Lo que el panel necesite y la API no tenga. No se inventa: se anota aquí.)_

- **A3 Crear / restablecer contraseña:** el diseño dice "Clínica Veterinaria Patitas te registró" y "Guardar y entrar", pero no hay forma de saber qué negocio registró al cliente a partir del token, y `POST /auth/reset-password` no inicia sesión. Mientras tanto: texto genérico y, al guardar, ir al login con un aviso de éxito. Propuesta: `GET /auth/reset-password/:token` que devuelva el negocio (solo en el enlace de bienvenida), o que el restablecimiento devuelva la sesión.
- **Simulación de `citas_afectadas` (E2, D5 y D6):** `PUT /sucursales/:id/horarios`, `PUT /empleados/:id/horario-semanal` y `POST`/`PATCH`/`DELETE` de excepciones de disponibilidad devuelven `citas_afectadas` solo en esa respuesta. Falta una simulación antes de guardar (`?simular=true`) para el aviso previo de D6 ("2 citas quedarán fuera"), o poder consultar después las citas fuera de la disponibilidad. Mientras tanto, el aviso aparece después de guardar y se puede copiar la lista.
- **Motivo del 401:** cuando el servidor cierra una sesión (cambio de contraseña en otro dispositivo), el 401 no dice por qué. Algo como `errors.motivo: "password_cambiada"` permitiría explicarlo en el login; mientras tanto el texto es genérico.
- **`GET /invitaciones/mias`:** quien espera una invitación no la ve en `/bienvenida` sin abrir el correo.
- **Instagram (E1):** el mockup muestra un usuario de Instagram como "Sitio web", pero `negocios` no tiene columnas de redes sociales y `sitio_web` exige una URL. El panel muestra "Sitio web" con URL. Propuesta: columna `instagram` (usuario sin `@`) o una tabla de redes.
- **Cambios simultáneos en los profesionales de un servicio (D2 y D3b):** `empleados` en `PATCH /servicios/:id` (y `servicios` en `PATCH /empleados/:id`) reemplaza el conjunto completo. Si dos personas editan a la vez (una el servicio, otra al miembro), gana la última y puede deshacer la asignación de la otra. El panel lo reduce enviando la lista solo si cambió. Propuesta: control de versión (enviar `fecha_actualizacion` y recibir 409 si cambió) o cambios parciales (`empleados_agregar` / `empleados_quitar`).
- **Conteos del catálogo (D1):** el encabezado ("N servicios · M reservables desde la app") y el aviso de servicios sin profesionales necesitan todo el catálogo, que el panel pide de 100 en 100. Sirve para catálogos de cientos. A futuro: `meta.resumen` con `{ total, reservables_app, sin_profesionales }`.
- **"Desde" y "Todo el día" del mockup (D1 y D2):** la API tiene `tipo_precio` fijo, por hora, por día y variable, y no hay un precio "desde" ni una duración "todo el día". El panel muestra un precio variable sin máximo como "Desde $X" y una duración de 1440 minutos como "Todo el día".
- **Disponibilidad efectiva en lote (B9):** la vista Día pide `GET /empleados/:id/disponibilidad-efectiva` y las excepciones del día (`GET /empleados/:id/disponibilidad`) por cada profesional: 2 consultas por columna. Sirve para equipos pequeños; con muchos profesionales conviene `GET /negocios/:id/disponibilidad-efectiva?fecha&id_sucursal` con todos los empleados (rangos y excepciones del día) en una consulta.
- **Horarios libres y la agenda de la mascota (B7 y B5):** los horarios libres son por profesional: no descartan las horas en que la mascota ya tiene otra cita, y eso se sabe al enviar (409 "La mascota ya tiene otra cita a esa hora"). El diálogo lo muestra y recarga los horarios. A futuro: `id_mascota` opcional en los horarios libres para quitarlas de antemano.
- Resueltos en P4.2 (backend): detalle del panel con raza, edad, peso, alergias y fallecido de la mascota, y email y `usa_app` del cliente (con `citas.ver`); `GET /citas/:id/profesionales-libres` (`citas.editar`); `id_cita_excluir` en los horarios libres del panel (de este negocio y con `citas.editar`), que aceptan `citas.crear` o `citas.editar`; `usuario` y `empleado` del historial documentados en Swagger; historial completo de las citas del seed.
- Resueltos en P4.1 (backend): `GET /negocios/:id/profesionales` con `citas.ver` (el rol Recepcionista no tiene `empleados.ver`); `GET /negocios/:id/citas/atencion` (por confirmar y fuera de disponibilidad, desde hoy y sin límite de rango); `motivo_fuera` en `CitaPanel` (el tipo para `citas.ver`; el texto solo con `configuracion.ver` o al propio empleado de la cita); el `motivo` de las excepciones en `GET /empleados/:id/disponibilidad` sigue la misma regla (antes llegaba a cualquiera con `citas.ver`).
- Resueltos en P3 (backend): `GET /servicios/:id/gestion` (detalle del panel, también inactivos y ocultos); el 409 al eliminar un servicio con citas trae `data.citas_afectadas`; la API aplica la regla de fechas de la oferta (obligatorias y fin desde hoy al crearla o cambiarla).
- Resueltos en P2 (backend): `servicios` en `POST`/`PATCH /empleados` (con `servicios.editar`); `servicios`, `es_propietario` e `invitacion` (vencimiento, envíos restantes en 24 h y `libre_desde`) en el listado de empleados; `GET /negocios/:id/roles` también con `empleados.crear` o `empleados.editar`; `empleados_inactivos` en cada rol y un 409 al eliminar que los cuenta; `id_empleado` del propietario en `/negocios/mios`.
- Resueltos en P1 (backend): `GET /negocios/:id/gestion` (datos privados, negocio inactivo y `reglas_confirmacion` con las citas perdidas en 30 días); `configuracion_pendiente` en `/negocios/mios` y `/auth/me`; `GET /politica-datos` público; `politica_aceptada` (versión, fecha y canal) en `/auth/me`; `POST /auth/request-verification` sin sesión; `canal: "panel"` en el registro; texto de `citas_afectadas` en horarios.
- Resuelto: Swagger marca como requeridos los campos de las respuestas (convención `x-opcional` y verificación en los tests del backend); `schema.d.ts` ya no deja todo opcional.
- Resueltos antes de P0: permisos del rol en `/negocios/mios` y `/auth/me` (`rol.permisos_json`); `politica { version, url }` en `/auth/me`; `vet.salud@petcat.test` con dos negocios en el seed. La sección "Qué cambió" de A9 no tiene datos en la API y no se muestra.

## Decisiones
- Calendario propio en lugar de FullCalendar Scheduler (licencia comercial). Sin arrastrar y soltar en el v1: mover una cita es reprogramar. Alternativa futura: react-big-calendar (MIT).
- Mapas con Google Maps (`@vis.gl/react-google-maps`) y Places Autocomplete, por la calidad de las direcciones colombianas. Clave restringida por dominio y por API, con alerta de presupuesto en Google Cloud. El panel funciona sin clave (coordenadas manuales).
- Access token en memoria y refresh token en `localStorage` en el MVP (deuda: cookie httpOnly).
- Negocio activo en la URL (`/n/:idNegocio/...`).
- Diseño de escritorio, ancho mínimo 1280 px.
- Sesión entre pestañas (P0): la pestaña que renueva el token avisa a las demás por BroadcastChannel con los tokens nuevos; `navigator.locks` deja renovar a una pestaña a la vez, y la que esperaba usa los tokens que llegaron en lugar de volver a renovar. También se avisan el inicio y el cierre de sesión. "Recordarme" guarda el refresh token en `localStorage`; sin él va en `sessionStorage` y una pestaña nueva se lo pide a las abiertas (al cerrar todas, la sesión termina).
- TypeScript 5.9 (no 6 ni 7): openapi-typescript y typescript-eslint todavía no los soportan.
- Playwright usa el Chrome instalado en el equipo (`channel: "chrome"`), sin descargar navegadores; `E2E_CHANNEL=chromium` usa el de Playwright. Las pruebas de punta a punta no corren en CI porque necesitan la API con la base de demo.
- Radios: 8 controles, 16 tarjetas y 20 modales (la guía del Figma ya está corregida a 16).
- La API del panel en desarrollo es el servicio `backend-demo` de Docker (127.0.0.1:3001, `petcat_demo`), con recarga automática usando `docker-compose.dev.yml`. El proxy de Vite apunta a `VITE_API_PROXY_TARGET` (por defecto ese puerto). `petcat_backend` (3000, `petcat_db`) no se usa para el panel.
- Las secciones del menú existen desde P0 como rutas con permiso y un aviso "en construcción"; cada fase reemplaza el aviso por la pantalla real.
- En P0 la búsqueda y la campana del Topbar están deshabilitadas (llegan en P5 y P6). La tarjeta del plan usa `GET /negocios/:id/suscripcion` solo si el rol tiene `configuracion.ver`; si no, muestra solo el nombre del plan.
- P1: los huecos de API que bloquean o simplifican P1 se resuelven en el backend, en commits propios con Swagger y tests, antes de las pantallas: `GET /negocios/:id/gestion` con reglas de confirmación, `configuracion_pendiente` en `/negocios/mios` y `/auth/me` (el panel no lo calcula), `GET /politica-datos` público, fecha y versión aceptadas en `/auth/me`, reenvío de verificación sin sesión (respuesta neutra y límite estricto), registro con canal `panel` y el texto de `citas_afectadas` en horarios.
- P1: el asistente de crear negocio escribe en la API en cada paso (el negocio se crea en el paso 1) y se retoma desde `configuracion_pendiente`. Solo el propietario es redirigido al asistente.
- P1: `VITE_GOOGLE_MAPS_MAP_ID` opcional (el `AdvancedMarker` lo exige); sin él se usa `DEMO_MAP_ID`.
- P1: no hay ruta `/bienvenida`. Después de crear la cuenta se va a `/negocios`, que sin negocios muestra la bienvenida (aviso de verificación con reenvío, crear negocio o "Ya acepté la invitación"). Es el mismo estado vacío de A5. El registro envía `tipo_usuario: "negocio"` y `canal: "panel_web"` y luego inicia sesión con las mismas credenciales.
- P1: A8 funciona con o sin sesión y llama a la API una sola vez. Con el enlace vencido: con sesión, reenvía (`resend-verification`); sin sesión, pide el correo (`request-verification`, respuesta neutra).
- P1: A4 con otra sesión abierta avisa antes y, al aceptar, cierra la sesión anterior y entra con la invitada (`reemplazar` en el store). El orden importa: primero se acepta (si falla, la sesión anterior sigue), luego se cierra la anterior (las otras pestañas quedan sin sesión) y por último se entra (las otras pestañas toman la nueva).
- Pruebas de punta a punta de A4: Salud Animal 24h (Pro en prueba, sin límite de empleados) crea e invita empleados con correos únicos, y el enlace se lee del correo en Mailpit (`tests/e2e/mailpit.ts`, API en http://127.0.0.1:8025). Cada corrida deja empleados de prueba en `petcat_demo`; se limpian recargando la demo.
- P1: el último paso de A6 dice "Terminar" y no "Crear negocio" como el mockup: el negocio ya existe desde el paso 1. El aviso del plan Gratuito usa los límites de `GET /planes`. `api:types` genera con `--default-non-nullable false`: un campo con `default` en un cuerpo de petición no es obligatorio.
- P1: Configuración tiene las pestañas Resumen, Perfil del negocio y Sedes y horarios; carga una vez `/gestion` para las tres. "Reglas de agenda" no se crea: su único dato es la confirmación automática, que está en E1.
- P1: el diálogo de citas afectadas vive en Raiz (store de UI) y lo abre el hook al guardar: si la semana queda sin horario, el propietario vuelve al asistente y la pantalla que guardó ya no existe. Se puede copiar la lista porque la API no la vuelve a dar.
- P1: el aviso de cambios sin guardar consulta el estado al momento de salir (no al pintar), para que se pueda navegar justo después de guardar. Una sola instancia por pantalla (React Router admite un bloqueador a la vez).
- P1: E1 aplica la confirmación automática al instante (vuelve atrás si la API falla). El aviso de citas perdidas usa `reglas_confirmacion.citas_perdidas` de `/gestion`. "Sitio web" acepta "patitas.co" y lo envía con `https://` (la API exige URL). La vista "Así te ven en la app" sigue el nombre escrito, sin la distancia.
- P1: en las pruebas, `request.formData()` de MSW no lee el multipart que arma jsdom; las subidas se verifican con el cuerpo crudo.
- P1: E6 vive en `/n/:id/mi-perfil` (menú del avatar). Al cambiar nombre o foto, la pestaña avisa a las demás por BroadcastChannel (`perfil`) y recargan `/auth/me`. Las notificaciones se guardan al instante. El cambio de contraseña deja esta sesión (y sus pestañas) y cierra las de otros dispositivos.
- Pruebas de punta a punta: `backend-demo` tiene límites de solicitudes mucho más altos (`RATE_LIMIT_MAX` 100000 y `AUTH_RATE_LIMIT_MAX` 10000 en `docker-compose.yml`) para que la suite no reciba 429. `petcat_backend` conserva 300 y 100.
- Google Maps con clave pero sin facturación (o clave inválida, o dominio no permitido): Google no lo avisa por código, solo pinta un mapa gris y escribe `Google Maps JavaScript API error: <Código>` en la consola. `lib/erroresGoogleMaps.ts` escucha esa línea y la ubicación de la sede pasa a coordenadas manuales con el motivo. Se recuerda el error, porque la API se carga una sola vez por página.
- Pruebas de punta a punta: construyen el panel en `dist-e2e` sin clave de Google y lo sirven con `vite preview` en el 5180 (mismo proxy a la API); no usan el Vite del 5173 ni dependen de `.env.local`. Corren de a una (`workers: 1`): comparten la demo y sus cuentas, y en paralelo el equipo llegaba al 100 % de CPU y fallaban al azar. Los correos se leen de Mailpit (`tests/e2e/mailpit.ts`).
- `/dev/estados` (solo en desarrollo) reúne los estados de S1, los estados de cita y los botones para revisarlos contra el Figma.
- P2: Equipo vive en `/n/:id/equipo` con las pestañas Miembros (`miembros`, requiere `empleados.ver`) y Roles y permisos (`roles`, requiere `roles.ver`). La disponibilidad está en `/n/:id/equipo/:idEmpleado/disponibilidad`: la ven quienes tienen `configuracion.ver` o `citas.ver` y el propio profesional, y la edita `configuracion.editar`. Un profesional sin `empleados.ver` llega a la suya solo por el enlace (no tiene Equipo en el menú).
- P2: "Servicios que atiende" se asigna desde el formulario del miembro con `servicios` en `POST`/`PATCH /empleados` (opción A), que exige también `servicios.editar`. Sin `servicios.ver` el campo no aparece; sin `servicios.editar` se ve deshabilitado con el motivo.
- P2: reglas de escalada en la interfaz (`reglasEscalada` en `lib/permisos.ts`, igual que la API, solo para empleados): no se asignan roles con permisos que el propio no tiene (tarjeta deshabilitada con el motivo), no se cambia el propio rol, no se desactiva uno mismo, no se edita, reactiva ni desactiva a un miembro con más permisos, y en D4 no se edita el propio rol ni uno con más permisos, y solo se marcan los permisos propios. Los permisos del rol de cada fila salen de `GET /roles`; si no se pudieran consultar, decide la API. El 403 se muestra igual.
- P2: la invitación no aplica escalada (decisión 0.C.5 del backend): una recepcionista con `empleados.crear` puede reenviar la del veterinario.
- P2: límite de empleados con `uso.empleados` de `/suscripcion` (con `configuracion.ver`): aviso con el uso y "el propietario no cuenta"; en el límite, "Agregar miembro" y "Reactivar" abren el diálogo de Pro sin llamar a la API (salvo reactivar al propietario, que no ocupa cupo). Sin `configuracion.ver` no hay aviso y el 403 con `errors.plan` abre el mismo diálogo.
- P2: "Reenviar (N de 4)" muestra los envíos que quedan en 24 horas (`invitacion.envios_restantes_24h`); en 0 queda deshabilitado con la hora de `libre_desde`. Sin invitación vigente el botón es "Enviar invitación" (sirve también si la anterior venció). "Vence en 2 días" se calcula en hora de Bogotá.
- P2: al crear un miembro, primero el `POST` (con sus servicios), después la foto y la invitación. Si la foto o el correo fallan, el miembro ya existe y el aviso dice qué falta para reintentarlo desde la lista. Un 409 por el correo de un miembro inactivo ofrece reactivarlo.
- P2: un solo campo "Documento" (el mockup separa tipo y número; la API tiene una columna).
- P2: `citas_afectadas` trae todas las citas que no caben, también las que ya estaban fuera antes (decisión 1.4 del backend): el texto es "N citas están fuera de la disponibilidad" en E2, D5, D6 y al desactivar. En D5 queda una tarjeta con las citas del último cambio y el detalle para copiar; "Reasignar" y "Reprogramar" llegan en P4.
- P2: "Agregarme como profesional" aparece al propietario sin registro como empleado (`id_empleado` null en `/negocios/mios`). Si su registro está inactivo, se reactiva desde su fila.
- P2: sin horario propio, cada día de D5 muestra el horario de la sede y se puede partir de él. Las sedes salen de `/gestion` con `configuracion.ver` y del perfil público si no.
- Pruebas de punta a punta de P2: invitaciones en Salud Animal 24h con correos únicos (el enlace se lee de Mailpit; se agotan los 4 envíos de ese correo) y un negocio Gratuito nuevo por corrida para el límite del plan.
- P3: los huecos de API de servicios se resolvieron en el backend antes de las pantallas, en commits propios con Swagger y tests (detalle del panel, citas en el 409 al desactivar, regla de fechas de la oferta). Los errores de la API pueden traer `data`; el `ApiError` del panel lo expone en `error.data`.
- P3: Servicios vive en `/n/:id/servicios` (D1), `/servicios/nuevo` y `/servicios/:idServicio` (D2, página completa como el mockup). Requiere `servicios.ver`; crear, `servicios.crear`; sin `servicios.editar`, D2 es de solo lectura. El detalle sale de `GET /servicios/:id/gestion`.
- P3: D1 carga todo el catálogo (de 100 en 100) y filtra en el navegador (texto sin tildes, categoría y estado: Activos, Inactivos, Todos, Sin profesionales). Encabezado: servicios activos y "reservables desde la app" (activo, visible y `reservable`). "Sin profesionales" es activo, requiere cita y `sin_empleados`; un servicio sin cita es reservable sin profesionales. El aviso amarillo nombra el servicio y lleva a `#profesionales` de D2 ("Asignar →", con `servicios.editar`); con varios, "Ver cuáles" aplica el filtro.
- P3: estado de la oferta en la tarjeta: "En oferta" (vigente, con el precio base tachado), "Oferta desde el …" (programada) u "Oferta vencida", con las fechas en hora de Bogotá. Precio según el tipo: "/ hora", "/ día", "Desde $X" (variable sin máximo) o "$X – $Y".
- P3: reglas de D2 iguales a las de la API (Zod en `features/servicios/schemas.ts`): "Todas" es exclusiva (al marcar una especie se desmarca, y al revés); precio máximo ≥ base; duración entre 5 y 1440 y margen entre 0 y 240, en múltiplos de 5; máximo de citas entre 1 y 255 (vacío = sin límite); al menos un día (los siete se envían como `null`). Oferta: precio menor que el base y fechas obligatorias; el inicio se propone con hoy y el fin no puede ser anterior a hoy, pero solo al crear la oferta o cambiar sus campos. Con una oferta vencida sin tocar se guarda lo demás, con un aviso y "Quitar oferta". Al apagar la oferta se envían su precio y fechas en `null`.
- P3: dinero en pesos sin decimales con separador de miles (`CampoDinero`). El PATCH envía solo los campos que cambiaron (las etiquetas de la API no están en el mockup: ni se muestran ni se envían, así se conservan).
- P3: profesionales del servicio = miembros activos (`GET /negocios/:id/empleados`, requiere `empleados.ver`), con la especialidad o el rol. Sin `empleados.ver` se ven los asignados sin poder cambiarlos y no se envían. Se puede guardar sin profesionales, con una confirmación ("Aparecerá en la app, pero nadie podrá reservarlo…") cuando el servicio es nuevo o antes era reservable.
- P3: consistencia con Equipo: las dos pantallas escriben en la API (`empleados` del servicio, `servicios` del miembro) y recargan las consultas de la otra (las claves de servicios empiezan por `["servicios", idNegocio]`; guardar un servicio recarga `["empleados"]`). La lista de profesionales se envía solo si cambió, para no pisar una asignación hecha desde el miembro (el resto queda en Pendientes de API).
- P3: indicaciones previas en un solo párrafo (Enter no hace nada y los saltos pegados se cambian por un espacio), hasta 500 caracteres con contador. La vista previa reproduce el texto del recordatorio de la API ("Mañana, … Indicaciones del negocio: ….") con una mascota de muestra, y aclara que va en la app y el correo, no en la push.
- P3: desactivar con citas futuras: el 409 trae las citas y se abren en el diálogo de citas afectadas, con otro título y descripción (nada se guardó). Reactivar con el nombre ocupado ofrece "Cambiar nombre": lleva a D2 del servicio inactivo, que se queda en la pantalla al guardar para reactivarlo desde el aviso. El botón "Reactivar" se deshabilita mientras haya cambios sin guardar.
- P3: en las pruebas, `renderRuta` conserva el `#hash` de la ruta y el setup agrega `hasPointerCapture` y `scrollIntoView` (el Select de Radix los usa y jsdom no los trae).
- Pruebas de punta a punta de P3: en Patitas, con nombres únicos (crear con oferta, profesional e indicaciones, ver la asignación en Equipo y quitarla desde el miembro, desactivar "Consulta general" con citas del seed, reactivar con el nombre ocupado). Dejan servicios en `petcat_demo`; se limpian recargando la demo.
- P4: cuatro sub-bloques aprobados por separado (calendario y vistas; detalle y acciones; nueva cita con C3; tiempo real). Los huecos de API de cada uno se resuelven en el backend al empezarlo, en commits propios con Swagger y tests.
- P4.1: la agenda vive en `/n/:id/agenda` con su estado en la URL (`vista`, `fecha`, `profesional`, `estados`, `sede`, `mias`, `fuera`, `cita`), así un enlace abre la misma vista. Cambiar de semana o de vista va al historial; elegir una cita de la misma semana, no. Elegir una cita fija también su fecha: "Día" abre el día de la cita, y una tarjeta del panel de otra semana lleva a esa semana. El detalle (B4) se abre con `?cita=`.
- P4.1: Semana de lunes a domingo; se oculta el día en que ninguna sede abre y no hay citas. Lo cerrado se sombrea con la unión de los horarios de las sedes que se ven ("Cerrado 12:00–14:00", "Cerrado desde las 12:00", "Abre a las 09:00"). Cuadrícula de 15 minutos (64 px por hora) entre la primera apertura y el último cierre (o la primera y la última cita). La línea de la hora (Bogotá) se renueva cada minuto; al abrir, se baja hasta ella solo si queda fuera de la vista.
- P4.1: Día por profesional: columnas para quien atiende servicios (`GET /profesionales`), más quien tenga citas ese día aunque ya no esté activo, y "Sin profesional" si hay citas sin asignar. El sombreado sale de su disponibilidad efectiva en la sede; los bloqueos y vacaciones del día se pintan aparte con su etiqueta, y lo que tapan no se marca además como cerrado. El texto del motivo se muestra solo si la API lo envía.
- P4.1: Lista de la semana agrupada por día: hoy y los siguientes primero, después los pasados del más reciente hacia atrás. Con `fuera=1` muestra todas las citas fuera de disponibilidad desde hoy (de `/citas/atencion`, sin rango): es el destino de "Ver en la agenda" del diálogo de citas afectadas y del enlace del panel lateral.
- P4.1: con "Todos los estados" se ven también las canceladas, las de no asistió y las reprogramadas, atenuadas. "Solo mis citas" aparece solo si el usuario es profesional del negocio (`id_empleado` en `/negocios/mios`) y reemplaza el filtro de profesional.
- P4.1: el panel lateral y el número del menú salen de `/citas/atencion` (por confirmar ordenadas por plazo, "Se cancela sola en 2 h"; fuera de disponibilidad con su motivo). En P4.1 las tarjetas solo llevan a la cita; Confirmar, Rechazar, Reasignar y Reprogramar llegan en P4.2. "+ Nueva cita" se ve deshabilitado hasta P4.3.
- Seed de demo (P4.1): semana de agenda en Patitas alrededor del día de carga, con Paula Rojas (Patitas queda en 3 de 3 empleados), Lorena (con app) y Pedro (sin app). Las pendientes se cancelan solas al vencer su plazo: las pruebas de punta a punta de la agenda necesitan la demo recargada el mismo día.
- P4.2: B4 es un panel lateral sobre la agenda (`?cita=`). Las acciones dependen del estado, la hora de Bogotá y el rol, con las reglas de la API (`accionesDe` en `features/agenda/acciones.ts`): pendiente → Confirmar, Reprogramar, Rechazar; confirmada → Iniciar atención (desde el día de la cita), Completar y No asistió (desde la hora de inicio), Reprogramar, Cancelar; en curso → Completar; no asistió del mismo día → "Llegó tarde: pasar a en curso". Confirmar, editar y reprogramar piden `citas.editar`; cancelar y rechazar, `citas.cancelar`.
- P4.2: "Completar" desde una confirmada que ya empezó hace dos llamadas seguidas (en curso y completada). Si la segunda falla, la cita queda en curso, el diálogo lo dice y el botón reintenta solo completar. "Iniciar atención" sigue disponible.
- P4.2: los diálogos de las acciones (cancelar o rechazar, reprogramar, completar, reasignar) viven en PanelLayout (`AccionesCita`) y se abren con `useUi().abrirAccionCita(tipo, idCita)` desde el detalle, el panel lateral, el diálogo de citas afectadas y D5. Al resolver una cita afectada sale de esa lista; si se resuelven todas, el diálogo se cierra. En D5 la tarjeta dice "Reasignar o reprogramar" (con `citas.editar`).
- P4.2: Rechazar es cancelar una pendiente: mismo diálogo y motivo obligatorio (lo ve el cliente). Reprogramar propone los próximos 4 días en que abre la sede y una fecha libre; "Cualquier profesional" deja que la API asigne; el 409 se muestra en el diálogo y recarga los horarios; al terminar se abre la cita nueva en la agenda. Reasignar muestra a todos los que atienden el servicio y solo deja elegir a los libres, con el motivo de los demás.
- P4.2: B8 propone el precio estimado; el aviso de la invitación a reseñar aparece solo si el cliente usa la app. "Crear el registro médico al terminar" se oculta hasta P5 (C4), igual que "Ver ficha médica".
- Pruebas de punta a punta de P4: crean sus citas por la API en Salud Animal (Pro, sin límite; la app deja las reservas pendientes) y cancelan al final lo que dejaron activo, así no dependen de las citas del seed que vencen. "Iniciar y completar" necesita un horario libre hoy (Sede Norte abre de 7 a 21) y se salta si no hay.
- Pruebas del panel: la de D2 que llena todo el formulario tiene su propio límite de 40 s (con la suite completa en paralelo pasaba de los 15 s globales).
