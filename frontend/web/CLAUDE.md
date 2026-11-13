# PetCat · Panel web — Instrucciones para Claude Code

Lee también el `CLAUDE.md` de la raíz (contexto del negocio y de la API). El plan de trabajo del panel está en `frontend/web/PLAN.md`: revísalo al iniciar cada sesión y marca las casillas al terminar cada tarea.

## Qué es

El panel web es la herramienta de los **negocios** (veterinarias, peluquerías, guarderías…): agenda, clientes, historial médico, servicios, equipo, configuración, reseñas, suscripción y dashboard. Los dueños de mascotas usan la app móvil (`frontend/mobile`, otro proyecto).

Objetivo de esta versión: **implementar todas las pantallas del Figma conectadas a la API real** (Fases 0–2 del backend), para probar la plataforma de punta a punta.

## Fuentes de verdad

1. **API:** Swagger en `http://localhost:3000/api/v1/docs` y la especificación en `/api/v1/docs.json`. Los tipos se generan de ahí; nunca se escriben a mano.
2. **Diseño:** Figma, archivo `AXEbm1XsESvYf2S2W7oRUj` ("PetCat — Wireframes Panel Web"), primera página.
   - Índice de pantallas con sus endpoints: nodo `125:1882`.
   - Guía de estilo: nodo `115:181`. Componentes: `Panel/Sidebar` (`115:2`) y `Panel/Topbar` (`115:68`).
   - Secciones: 00 Sistema de diseño · A Acceso · B Dashboard y agenda · C Clientes · D Servicios y equipo · E Negocio · F Estados del sistema y administración.
   - Los wireframes de arriba ("Wireframes originales") son solo referencia histórica: **no se implementan**.
   - Si existen capturas en `frontend/web/docs/mockups/`, úsalas primero; consulta Figma solo para medidas o detalles, porque el conector tiene un límite de uso.
3. **Si el diseño y la API no coinciden, manda la API.** No se inventan campos ni datos. Si a una pantalla le falta algo de la API, se anota en "Pendientes de API" en `PLAN.md` y se avisa.

## Stack (decidido)

- React + Vite + **TypeScript** (modo estricto).
- Tailwind CSS con los tokens de abajo, componentes **shadcn/ui** adaptados al diseño, íconos **lucide-react** (los emojis del Figma son marcadores).
- React Router (rutas anidadas y protegidas).
- TanStack Query para todo dato de la API; **Axios** como cliente.
- React Hook Form + Zod para formularios.
- Zustand para la sesión y el negocio activo.
- TanStack Table para tablas; **Recharts** para gráficos.
- **Calendario propio** (CSS grid + eventos posicionados) para las vistas Semana y Día por profesional, con acomodo lado a lado de citas que se cruzan. Sin arrastrar y soltar: mover una cita es reprogramar (B7). No usar FullCalendar Scheduler (licencia comercial). Si en el futuro se necesita arrastrar y soltar o vista de mes, la alternativa aprobada es react-big-calendar (MIT).
- **Google Maps** con `@vis.gl/react-google-maps` para ubicar sedes, y **Places Autocomplete** para buscar direcciones (A6b y E2). Clave en `VITE_GOOGLE_MAPS_API_KEY`. Si no hay clave configurada, el formulario de sede funciona igual con latitud y longitud manuales y sin mapa. La API solo guarda latitud y longitud; la búsqueda "cerca de mí" no depende de Google.
- socket.io-client para notificaciones en tiempo real.
- date-fns (locale `es`), zona `America/Bogota`.
- `openapi-typescript` para generar `src/api/schema.d.ts` desde `/api/v1/docs.json`.
- Pruebas: Vitest + Testing Library (unidades y componentes), **Playwright** (flujos de punta a punta contra la API con el seed de demo).

## Tokens de diseño

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#0F7D76` | Botones principales, enlaces, acentos (antes `#14A39A`; oscurecido para AA: blanco encima 5:1) |
| `primary-dark` | `#0B6F69` | Hover, texto sobre `primary-soft` y `selected` (5,4:1) |
| `primary-deep` | `#0B6F69` | Final del degradado (hoy igual a `primary-dark`); páginas públicas |
| `primary-soft` | `#E3F6F3` | Ítem activo del menú, fondos de acento |
| `selected` | `#F0FAF9` | Filas o tarjetas seleccionadas |
| `ink` | `#1E2A3B` | Texto principal, avisos oscuros |
| `muted` | `#5B6B7C` | Texto secundario |
| `subtle` | `#606E7D` | Placeholders, etiquetas de grupo |
| `border` | `#E3E8EC` | Bordes |
| `surface` | `#F5F7F8` | Fondo de página |
| `track` | `#EEF2F4` | Encabezados de tabla, barras vacías |
| `info` / `info-soft` | `#1368DB` / `#EAF2FE` | |
| `warning` / `warning-ink` / `warning-soft` | `#F29921` / `#A25D00` / `#FFF2D9` | Pendientes, avisos |
| `danger` / `danger-soft` | `#D31E24` / `#FDECEC` | Errores, cancelaciones |
| `done` / `done-soft` | `#7250D3` / `#EEE8FB` | Cita completada |

Contraste: todo texto llega a 4,5:1 (AA). Los tokens de texto se oscurecieron lo justo, con el mismo matiz, en `src/index.css`; `warning` (naranja) solo va en íconos y fondos, y con texto blanco se usa `warning-ink`. Nada de `opacity-*` sobre texto para atenuar. Degradado de los paneles de acceso: `#17B5AB → #0B6F69`. Tipografía: **Inter** (pendiente: el equipo evalúa una fuente redondeada). Radios: 8 (controles), 16 (tarjetas), 20 (modales). Espaciado en múltiplos de 4. Diseño de escritorio, ancho mínimo 1280 px (las páginas públicas `/` y `/para-negocios`, en `features/publico`, son mobile first desde 360 px y el texto blanco va sobre `primary-dark` o `primary-deep`, no sobre `primary`).

**Estados de cita** (componente `EstadoCitaBadge`, un solo lugar): pendiente → warning · confirmada → primary · en_curso → info · completada → done · cancelada → danger (con variante "sistema" y "tardía") · no_asistio y reprogramada → gris.

## Estructura

```
frontend/web/
├── CLAUDE.md · PLAN.md · .env.example
├── docs/mockups/            # capturas exportadas del Figma (opcional)
├── src/
│   ├── app/                 # router, providers, layouts (AuthLayout, PanelLayout)
│   ├── api/
│   │   ├── schema.d.ts      # GENERADO: npm run api:types (no editar)
│   │   ├── client.ts        # Axios + interceptores (token, refresh, errores)
│   │   └── <modulo>.ts      # funciones por módulo: citas.ts, clientes.ts…
│   ├── features/<modulo>/   # pages/, components/, hooks/ (useXxx con TanStack Query), schemas.ts
│   ├── components/ui/       # shadcn adaptado a los tokens
│   ├── components/common/   # PageHeader, DataTable, Modal, Drawer, EmptyState, EstadoCitaBadge, PlanLimitDialog…
│   ├── lib/                 # format.ts (fechas, dinero), permisos.ts, socket.ts, queryKeys.ts
│   └── stores/              # auth.ts, negocio.ts
└── tests/e2e/               # Playwright
```

## Convenciones obligatorias

**Datos y API**
- Los componentes nunca llaman a Axios. Cada módulo expone funciones en `src/api/<modulo>.ts` y hooks de TanStack Query en `features/<modulo>/hooks/`. Las claves de caché salen de una fábrica en `lib/queryKeys.ts`.
- Respuestas: `{ success, message, data, meta }`. El cliente devuelve `data` (y `meta` cuando hay paginación).
- Errores, manejados en un solo lugar:
  - 401 → un único intento de `POST /auth/refresh-token` (el refresh rota en cada uso; evitar dos renovaciones simultáneas con una sola promesa compartida) y, si falla, cerrar sesión e ir al login.
  - 403 con `errors.plan` → `PlanLimitDialog` (invitación a Pro). 403 sin `plan` → estado "Sin permiso".
  - 404 → estado "No encontrado". 409 → aviso flotante con `message` (por ejemplo, horario ocupado). 422 → `errors` por campo con `setError` de React Hook Form. 429 → aviso de esperar. Red caída → estado "Sin conexión".
- **Avisos de éxito de una mutación: en el hook, nunca en el componente.** El aviso ("Respuesta publicada", "Cita cancelada") va en el `onSuccess` del `useMutation` (con los datos de la respuesta o de las variables), no en `mutate(vars, { onSuccess })` del componente: TanStack descarta los callbacks de esa llamada si el componente que la hizo se desmonta antes de terminar (el formulario que desaparece al recargar, la fila que se vuelve a montar con un filtro), y el aviso se pierde aunque el cambio se guardó. Ya pasó dos veces (invitación en P6.2, respuesta a una reseña en P6.3). En la llamada solo queda lo que es del componente (cerrar el diálogo, resetear el formulario, marcar errores por campo). Un hook que no debe avisar en un lugar (el asistente de crear negocio avanza de paso) recibe `{ avisar: false }`. Única excepción: un flujo de varias mutaciones encadenadas con `await mutateAsync` (guardar y después subir archivos o invitar) avisa del resultado combinado al final, porque la promesa se resuelve aunque el componente se desmonte.
- Sesión: access token **en memoria**; refresh token en `localStorage` (decisión del MVP, anotada como deuda: a futuro, cookie httpOnly desde la API). Al cargar la app, si hay refresh token, se renueva antes de mostrar el panel.
- **Negocio activo en la URL:** rutas bajo `/n/:idNegocio/...`. El selector del menú cambia de negocio sin perder la sección. `/negocios/mios` define a qué negocios se puede entrar y con qué rol.
- **Permisos:** la UI oculta o deshabilita lo que el rol no permite (helper `puede(modulo, accion)`), pero la API es la que decide; siempre manejar el 403.
- Vite usa un proxy `/api` y `/socket.io` → `VITE_API_PROXY_TARGET` (por defecto `http://localhost:3001`, la API de demo en Docker), así no hay problemas de CORS en desarrollo. Variables: `VITE_API_URL=/api/v1`, `VITE_API_PROXY_TARGET`, `VITE_SOCKET_URL` (vacío: mismo origen, por el proxy) y `VITE_GOOGLE_MAPS_API_KEY` (opcional).
- Tipos: en las respuestas de Swagger todo campo que la API envía siempre es requerido (convención `x-opcional` del backend), así que `schema.d.ts` refleja lo que llega. Usar los tipos de `src/api/types.ts`; tras un cambio en la API, `npm run api:types`. La clave de Google queda visible en el navegador: debe estar restringida en Google Cloud a los dominios del panel (y `localhost` en desarrollo) y solo a Maps JavaScript API y Places API. Nunca se sube al repositorio: va en `.env.local`.

**Fechas, horas y dinero**
- La API envía fechas `YYYY-MM-DD` y horas `HH:MM` ya en hora de Bogotá. **No** convertirlas con `new Date('YYYY-MM-DD')` (se interpreta como UTC y corre el día): usar los helpers de `lib/format.ts`.
- Dinero: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.

**Imágenes y archivos**
- En listas, usar `*_miniatura_url`. Subidas por `multipart/form-data` a los endpoints de archivo (las URLs no van en los JSON).
- Los archivos privados traen URL firmada con `url_expira_en`: si vence, volver a pedir el registro (invalidar la consulta), nunca guardar la URL.

**Interfaz**
- Textos en español, tuteo, como en los mockups. Mensajes de error de la API se muestran tal cual.
- Accesibilidad básica: etiquetas en todos los campos, foco visible, modales y paneles laterales navegables con teclado y cerrables con Esc.
- Cada pantalla contempla sus estados: carga (esqueleto), vacío, error y sin permiso (sección F del Figma).

## Forma de trabajar

- Una rama por fase (`panel-p0`, `panel-p1`…) y un PR a `main` al cerrarla. Un commit por tarea lógica, en español (`feat(panel/agenda): vista Día por profesional`).
- Antes de cada sub-bloque: revisar las pantallas del Figma y los endpoints en Swagger, y **mostrar el plan para aprobación**.
- Después de cada cambio: `npm run typecheck`, `npm run lint`, `npm test`, y comprobar en el navegador contra la API con el seed de demo. No dar nada por terminado sin verlo funcionando.
- Subir la rama al terminar cada sub-bloque.
- Si una pantalla necesita algo que la API no tiene, no se inventa: se anota en "Pendientes de API" y se avisa a Amaurys.
- La terminal de Amaurys es PowerShell 5.1: comandos separados con `;`, nunca `&&`.

## Comandos

```powershell
# API de demo en Docker (127.0.0.1:3001, base petcat_demo), con recarga al guardar el backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile panel up -d --build backend-demo
docker compose exec backend-demo node scripts/db-demo.js   # recarga petcat_demo con el seed

cd frontend/web; npm run dev        # http://localhost:5173
npm run api:types                   # regenera src/api/schema.d.ts desde la API de demo (3001)
npm run typecheck; npm run lint; npm test
npm run test:e2e                    # Playwright contra la API de demo (usa el Chrome instalado)
npm run build
```

El contenedor `petcat_backend` (3000, `petcat_db`) es el de Amaurys: el panel no lo usa ni lo toca. Detalle de los dos backends en `backend/README.md`. En desarrollo, `/dev/estados` muestra los estados del sistema (S1), los de cita y los botones.
