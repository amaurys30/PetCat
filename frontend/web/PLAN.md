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
- [ ] D3 Equipo: miembros, estado de la invitación, reenviar, desactivar y reactivar, "Agregarme como profesional"
- [ ] D3b Agregar / editar miembro (rol, servicios que atiende, foto, enviar invitación)
- [ ] D4 Roles y permisos (catálogo de `GET /permisos`, roles del sistema bloqueados, regla de escalada)
- [ ] D5 Disponibilidad del profesional · D6 Nueva excepción (con `citas_afectadas`)

## P3 — Servicios
- [ ] D1 Catálogo de servicios (reservable, sin profesionales, oferta)
- [ ] D2 Formulario de servicio (especies, precios, oferta, margen, días, profesionales, indicaciones previas)

## P4 — Agenda y citas
- [ ] Componente de calendario propio (cuadrícula de 15 minutos, horario partido, línea de la hora actual, citas que se cruzan lado a lado; sin arrastrar y soltar)
- [ ] B3 Agenda semanal con el panel "Por confirmar" y "Fuera de disponibilidad"
- [ ] B9 Vista Día por profesional · B10 Vista Lista
- [ ] B4 Detalle de cita (panel lateral): datos, cumplimiento del cliente, notas internas, historial, plazo para confirmar
- [ ] B5 Nueva cita: búsqueda de cliente, horarios libres, origen
- [ ] B6 Cancelar · B7 Reprogramar · B8 Completar / No asistió
- [ ] Actualizar la agenda con los eventos de Socket.IO

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
- **Horarios (E2):** `PUT /sucursales/:id/horarios` devuelve `citas_afectadas` solo en esa respuesta. Falta una simulación antes de guardar (`?simular=true`) o poder consultar después las citas que quedaron fuera del horario. Mientras tanto, el diálogo de E2 permite copiar la lista.
- **Motivo del 401:** cuando el servidor cierra una sesión (cambio de contraseña en otro dispositivo), el 401 no dice por qué. Algo como `errors.motivo: "password_cambiada"` permitiría explicarlo en el login; mientras tanto el texto es genérico.
- **`GET /invitaciones/mias`:** quien espera una invitación no la ve en `/bienvenida` sin abrir el correo.
- **Instagram (E1):** el mockup muestra un usuario de Instagram como "Sitio web", pero `negocios` no tiene columnas de redes sociales y `sitio_web` exige una URL. El panel muestra "Sitio web" con URL. Propuesta: columna `instagram` (usuario sin `@`) o una tabla de redes.
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
- Pruebas de punta a punta de A4: Salud Animal 24h (Pro en prueba, sin límite de empleados) crea e invita empleados con correos únicos, y el enlace se lee del log de `backend-demo`. Cada corrida deja empleados de prueba en `petcat_demo`; se limpian recargando la demo.
- P1: el último paso de A6 dice "Terminar" y no "Crear negocio" como el mockup: el negocio ya existe desde el paso 1. El aviso del plan Gratuito usa los límites de `GET /planes`. `api:types` genera con `--default-non-nullable false`: un campo con `default` en un cuerpo de petición no es obligatorio.
- P1: Configuración tiene las pestañas Resumen, Perfil del negocio y Sedes y horarios; carga una vez `/gestion` para las tres. "Reglas de agenda" no se crea: su único dato es la confirmación automática, que está en E1.
- P1: el diálogo de citas afectadas vive en Raiz (store de UI) y lo abre el hook al guardar: si la semana queda sin horario, el propietario vuelve al asistente y la pantalla que guardó ya no existe. Se puede copiar la lista porque la API no la vuelve a dar.
- P1: el aviso de cambios sin guardar consulta el estado al momento de salir (no al pintar), para que se pueda navegar justo después de guardar. Una sola instancia por pantalla (React Router admite un bloqueador a la vez).
- P1: E1 aplica la confirmación automática al instante (vuelve atrás si la API falla). El aviso de citas perdidas usa `reglas_confirmacion.citas_perdidas` de `/gestion`. "Sitio web" acepta "patitas.co" y lo envía con `https://` (la API exige URL). La vista "Así te ven en la app" sigue el nombre escrito, sin la distancia.
- P1: en las pruebas, `request.formData()` de MSW no lee el multipart que arma jsdom; las subidas se verifican con el cuerpo crudo.
- P1: E6 vive en `/n/:id/mi-perfil` (menú del avatar). Al cambiar nombre o foto, la pestaña avisa a las demás por BroadcastChannel (`perfil`) y recargan `/auth/me`. Las notificaciones se guardan al instante. El cambio de contraseña deja esta sesión (y sus pestañas) y cierra las de otros dispositivos.
- Pruebas de punta a punta: `backend-demo` tiene límites de solicitudes mucho más altos (`RATE_LIMIT_MAX` 100000 y `AUTH_RATE_LIMIT_MAX` 10000 en `docker-compose.yml`) para que la suite no reciba 429. `petcat_backend` conserva 300 y 100.
- `/dev/estados` (solo en desarrollo) reúne los estados de S1, los estados de cita y los botones para revisarlos contra el Figma.
