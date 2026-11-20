# PLAN.md — PetCat App móvil

Estado: ⬜ pendiente · 🟨 en curso · ✅ terminada

Figma (página "App móvil · Dueños de mascotas"): `https://www.figma.com/design/AXEbm1XsESvYf2S2W7oRUj/?node-id=188-3004`

## Mapa de pantallas

| Código | Pantalla | Nodo Figma | Fase |
|---|---|---|---|
| M1 | Bienvenida | 188:3072 | M1 |
| M2 | Crear cuenta | 188:3102 | M1 |
| M3 | Iniciar sesión | 188:3142 | M1 |
| M4 | Inicio | 190:3004 | M2 |
| M5 | Mis mascotas | 190:3136 | M2 |
| M6 | Ficha de mascota | 190:3223 | M2 |
| M21 | Agregar mascota | 195:3192 | M2 |
| M7 | Pasaporte PetCat | 191:3004 | M3 |
| M8 | Línea de vida | 191:3369 | M3 |
| M9 | Compartir pasaporte (QR) | 191:3486 | M7 |
| M10 | Explorar (mapa) | 193:3004 | M4 |
| M11 | Perfil del negocio | 193:3208 | M4 |
| M12 | Agendar cita | 193:3291 | M5 |
| M13 | Cita confirmada | 193:3386 | M5 |
| M17 | Mis citas | 194:3259 | M5 |
| M18 | Notificaciones | 195:3004 | M6 |
| M19 | Perfil y privacidad | 195:3058 | M6 |
| M20 | Calificar visita | 195:3144 | M6 |
| M14 | Eventos | 194:3004 | M8 |
| M15 | Detalle de evento | 194:3096 | M8 |
| M16 | Para Max (recomendaciones) | 194:3158 | Fase 3/4 |

---

## ✅ M0 · Base del proyecto

**Objetivo:** proyecto Expo funcionando en el teléfono, con tema visual, navegación vacía, cliente de API y pruebas configuradas.

- Crear `frontend/mobile/` con `create-expo-app` (TypeScript), Expo Router.
- Tokens en `src/theme/tokens.ts` + NativeWind + fuente Plus Jakarta Sans.
- Componentes base en `src/components/ui/`: `Button` (primario, secundario, suave, peligro), `Chip`, `Card`, `Input`, `Segmented`, `Toggle`, `Avatar`, `ScreenHeader`, `EmptyState`, `ErrorState`, `Skeleton`.
- **Barra de pestañas propia**: Inicio, Explorar, **Carnet (botón central elevado, degradado coral)**, Citas, Perfil. Pantallas vacías con título.
- Cliente HTTP con `EXPO_PUBLIC_API_URL`, interceptor de refresh (sin pantalla de login todavía), manejo de errores en español.
- Script `api:types` con openapi-typescript.
- Utilidades es-CO: dinero, fechas, horas, en `America/Bogota`.
- Jest + RNTL + MSW configurados, con pruebas de los componentes base y utilidades.
- ESLint (+ a11y) y `tsc --noEmit`. Workflow de GitHub Actions para `frontend/mobile/` (lint, typecheck, test).
- `eas.json` con perfiles `development`, `preview` (APK interno) y `production`.
- `frontend/mobile/.env.example` y README corto: cómo correrla en el teléfono con la IP local y el backend-demo (3001).

**Investigar y reportar en el plan (sin cambiar todavía):**
- Cómo recibe el backend el refresh token (cookie o cuerpo) y si sirve para móvil.
- Endpoint para registrar el token de Expo Push del dispositivo.
- Si los negocios públicos y la disponibilidad se pueden consultar sin sesión.

**Listo cuando:** la app abre en un Android físico, se navega entre las 5 pestañas, el botón Carnet se ve elevado, y lint, typecheck y pruebas pasan en CI.

### Resultado de M0 (rama `mobile/m0-cimientos`)

Hecho:
- [x] Expo SDK 58 (RN 0.88.1, React 19.3, TypeScript 6), Expo Router con `app/(tabs)` y `app/(auth)`, `app.config.ts` (`co.petcat.app`, scheme `petcat`), `eas.json`. Proyecto de EAS vinculado: `@petcat/petcat`, `projectId` `416e9696-62c4-451b-a495-2b29f7a627e3` en `extra.eas.projectId`, `owner: "petcat"`.
- [x] Tokens en `src/theme/tokens.ts` → `tailwind.config.js`; NativeWind 4.2.7 funciona con RN 0.88 (bundle de Android y prueba de estilos); Plus Jakarta Sans con una familia por peso.
- [x] Componentes base: `Text`, `Button` (primario, secundario, suave, peligro; más `claro` y `contornoClaro` para el degradado de marca), `Chip`, `Card`, `Input`, `Segmented`, `Toggle`, `Avatar`, `ScreenHeader`, `EmptyState`, `ErrorState`, `Skeleton`.
- [x] Barra de pestañas propia (`TabBar` + `CarnetTabButton`): 5 pestañas, Carnet elevado con degradado coral; franja transparente con `pointerEvents="box-none"` para que el círculo reciba toques completo en Android; `tablist`/`tab` con `selected`, Carnet anunciado como "Carnet de mis mascotas", etiquetas hasta `maxFontSizeMultiplier` 1,4; se oculta con el teclado en Android. La app abre en las pestañas (la sesión llega en M1); la bienvenida se abre desde Perfil.
- [x] Cliente HTTP (`src/api/client.ts`, `sesion.ts`, `refreshStorage.ts`, `errors.ts`): una sola renovación en curso (cola), rotación guardada primero en SecureStore, cierre de sesión con 401/403 del refresh (borra SecureStore, store y caché), sin cierre ante error de red, `sinRenovar`, errores en español. Probado con MSW.
- [x] `api:types` (openapi-typescript contra la API de demo) y `src/api/types.ts`.
- [x] Formatos es-CO sin `Intl` (`$45.000`, `vie 15 nov`, `8:30 a. m.`) con desfase fijo de Bogotá; pruebas con el equipo en `Asia/Tokyo`.
- [x] Prueba de contraste de los pares de tokens; env validado con Zod (`src/lib/env.ts`).
- [x] Jest + RNTL + MSW 3 (96 pruebas), ESLint con a11y, `tsc --noEmit`, job `app-movil` en `tests.yml` (además compila el bundle de Android).
- [x] `e2e/navegacion.yaml` (Maestro, local).
- [x] `.env.example` y README.

Prueba en Android (Expo Go por hotspot): carga y funciona. Corregido después:
- [x] "Volver" en una pantalla sin historial (abierta directo o tras recargar Metro, que reabre la última URL) daba `The action 'GO_BACK' was not handled by any navigator`. Ahora todo "Volver" y la flecha de `ScreenHeader` (`volverA`) usan `useVolver` de `src/lib/navegacion.ts`: `router.canGoBack() ? router.back() : router.replace(respaldo)`; respaldo Inicio por defecto, Perfil para Bienvenida y diagnóstico. Bienvenida tiene flecha Volver mientras se llegue desde Perfil (revisar en M1). Prueba con las rutas reales en `src/features/navegacion.test.tsx`.
- [x] Aviso "ImageBackground is deprecated": la app no usa `ImageBackground`; lo dispara NativeWind 4 (`react-native-css-interop` lo registra al cargarse). Se calla solo ese aviso con `LogBox.ignoreLogs` en `app/_layout.tsx`. Si se quiere quitar también de la terminal de Metro, la alternativa es un parche con patch-package.
- No correr `npm audit fix --force`: cambiaría versiones que fija el SDK 58.

Cierre (2026-11-18):
- [x] Probada en Android con Expo Go, también la corrección de "Volver". M0 terminada.

Queda para después (no bloquea M0):
- [ ] Correr `e2e/navegacion.yaml` con Maestro (no estaba instalado).

Desviaciones del plan aprobado:
- `danger` (`#D93F44`) no llega a AA como texto: se agregó `danger-ink` (`#B3262B`) para texto de error y el botón de peligro.
- Metro: `watchFolders`, `nodeModulesPaths` y `blockList` de `frontend/web`, pero **sin** `disableHierarchicalLookup`: rompe el bundle porque Reanimated usa su propio `node_modules/semver` anidado.
- MSW 3 en jest-expo necesitó: transformar sus paquetes ESM, un entorno de Jest que conserva el `fetch` de Node (el SDK 58 lo reemplaza por `expo/fetch`) y `onUnhandledFrame` en lugar de `onUnhandledRequest`.
- `openapi-typescript` declara TypeScript 5: se instala con `overrides`, como el plugin de a11y.
- Sin `EXPO_PUBLIC_API_URL`, en desarrollo la URL sale de la IP con la que Expo sirve el bundle + 3001.
- Las pruebas van junto al código (`src/**/*.test.ts(x)`); `test/` tiene el setup, el entorno, MSW y `render.tsx`.

Investigación:
- **Refresh token:** llega en el cuerpo, no en cookie: `POST /auth/refresh-token` con `{ refresh_token }`, rota en cada uso y devuelve `{ access_token, refresh_token, usuario }` (igual que el login). El backend no usa cookies. Sirve tal cual para móvil.
- **Expo Push:** `POST /dispositivos` `{ token_expo, plataforma }` y `DELETE /dispositivos` `{ token_expo }`, ambos con sesión; el token se valida con la forma `ExponentPushToken[...]`. El logout desactiva el dispositivo de la sesión. Para pedir el token hará falta el `projectId` de EAS (M6).
- **Sin sesión:** `GET /negocios` (búsqueda con `lat`, `lng`, `radio_km`), `/negocios/:id_negocio`, `/negocios/:id_negocio/sucursales`, `/negocios/:id_negocio/resenas`, `/sucursales/:id_sucursal`, `/sucursales/:id_sucursal/horarios`, `/servicios`, `/servicios/:id_servicio`, `/categorias-servicio` y `/citas/horarios-libres`. Agendar (`POST /citas`) pide sesión. Explorar y la consulta de disponibilidad no necesitan cambios en la API.
- Para M1: los enlaces de verificación y recuperación de los correos apuntan a `FRONTEND_URL` (el panel web, `localhost:5173` en desarrollo) y no abren en el teléfono. Se propondrá en el plan de M1 (deep link `petcat://` o publicar esas páginas).

## ✅ M1 · Acceso

- M1 bienvenida (carrusel de 3), M2 registro con aceptación de la política (Ley 1581, enlace a la política), M3 login, recuperar contraseña.
- Sesión persistente: al abrir la app, refresh silencioso → pestañas o bienvenida.
- Cerrar sesión borra tokens y caché.
- Caso "mi veterinaria me registró": activar cuenta con "olvidé mi contraseña".
- Pruebas: validaciones, login correcto/incorrecto, refresh en cola. Maestro: login.

### Resultado de M1 (rama `mobile/m1-acceso`)

Backend primero: PR #16 (`api/codigos-correo`, fusionado). Los correos de verificación y recuperación llevan un código de 6 dígitos además del enlace (`POST /auth/verify-email/codigo`, `POST /auth/reset-password/codigo`); se eligió frente a una página que intente abrir `petcat://` (los clientes de correo lo bloquean y no funciona en Expo Go) y a universal links / App Links (necesitan dominio y la app firmada; ver "Antes de publicar").

Hecho:
- [x] Arranque: el splash sigue hasta saber si hay sesión; refresh silencioso (máximo 8 s) y `GET /auth/me` → pestañas, aceptar la política o Bienvenida. Sin red: pantalla "Sin conexión" que conserva la sesión, con Reintentar, y reintenta sola cuando la red pasa de caída a disponible (NetInfo).
- [x] Rutas protegidas con `Stack.Protected` (sin sesión solo `(auth)`; con la política pendiente solo `aceptar-politica`). Login, cerrar sesión y aceptar la política redirigen solos.
- [x] M1 · Bienvenida con 3 láminas sin avance automático; ilustraciones armadas con componentes (Pasaporte en miniatura con sellos y QR, mapa simplificado con la ruta y las horas), ocultas al lector. El carrusel es un control ajustable ("Lámina 1 de 3" con el título y el texto). Sin flecha Volver.
- [x] M2 · Crear cuenta: validación como la API, medidor de contraseña en texto, casilla de la política separada del enlace "Ver política", `canal: "app"`; después entra solo y pasa a confirmar el correo. 409 → atajo "Activar mi cuenta con este correo"; 422 → error en su campo.
- [x] M3 · Iniciar sesión con `dispositivo` (modelo y sistema, `expo-device`). 401 → mensaje propio; 403 por bloqueo → mensaje de la API y atajo a recuperar; 429 → mensaje de la API.
- [x] Recuperar contraseña con código (correo → código y contraseña nueva → entra solo); también activa la cuenta que creó la veterinaria.
- [x] Confirmar el correo con código (reenviar, "Hacerlo después"); aviso en Perfil mientras no esté confirmado.
- [x] Aceptar la política cuando `requiere_aceptar_politica`. Mientras `politica_datos_url` esté vacía, "Ver política" abre un resumen en la app con aviso de versión provisional; con URL, el texto completo en el navegador.
- [x] Perfil mínimo con cerrar sesión (avisa a la API con 5 s de límite; borra tokens, sesión y caché aunque no haya red).
- [x] Accesibilidad: orden de foco con "siguiente" en el teclado, teclado y autocompletado por campo, Mostrar/Ocultar contraseña, errores en la etiqueta del campo y anunciados (iOS no tiene regiones vivas), foco al primer error.
- [x] Pruebas: 149 (arranque, rutas protegidas, cada pantalla y flujo con MSW, carrusel, dispositivo, medidor). Maestro: `e2e/login.yaml` y `e2e/navegacion.yaml` (ahora entra con login primero).
- [x] Contrato comprobado contra la API de demo con un usuario de prueba: registro (autorización canal `app`, versión 1.0), login con `dispositivo`, perfil, código del correo (Mailpit) y logout.

Cierre (2026-11-18):
- [x] Probada en Android con Expo Go. M1 terminada.

Queda para después (no bloquea M1):
- [ ] Correr los flujos de Maestro (`e2e/login.yaml` y `e2e/navegacion.yaml`; no estaba instalado).

Notas:
- Jest: `renderRouter` activa los timers falsos; `jest.config.js` deja `nextTick` y `setImmediate` reales (si no, ninguna llamada a la API termina en las pruebas de flujo).
- Contraseñas del seed: `backend/README.md`, "Usuarios de prueba". En la demo de este equipo la de `cliente@petcat.test` ya no coincidía con el seed (se cambió después de cargarlo): recargar la demo antes de correr Maestro.

## ✅ M2 · Inicio y mascotas

- M4 inicio: selector de mascota, héroe de mascota, próxima cita, recordatorios, accesos rápidos.
- M5 mis mascotas, M6 ficha (resumen, peso, datos clave), M21 agregar/editar mascota (foto con Cloudinary según la API actual).
- Estados vacíos (usuario sin mascotas → invitar a agregar).

### Resultado de M2 (rama `mobile/m2-mascotas`)

Backend primero: PR #18 (`api/mascotas-resumen`, fusionado): `GET /mascotas?incluir=resumen` (resumen de salud en lote: estado de vacunas, próximos eventos y próxima cita), tabla `mascota_pesos` (migración 029) con `GET /mascotas/:id/pesos` solo para el dueño, y la invitación a reseñar se anula si la mascota falleció.

Hecho:
- [x] M4 · Inicio: saludo según la hora de Bogotá, selector de mascotas (radio, con "+" para agregar), héroe con peso, vacunas y lo próximo, "Abrir su Pasaporte PetCat" (va a la pestaña Carnet con esa mascota), próxima cita o "no tiene citas próximas", recordatorios solo si hay. Sin campana, evento destacado ni accesos a fases futuras.
- [x] Mascota seleccionada recordada (Zustand persistido): si ya no está, falleció o es de otra cuenta, se muestra la primera viva; sin mascotas vivas, estado vacío.
- [x] M5 · Mis mascotas: tarjetas con una sola etiqueta para el lector y botón Carnet aparte; las que están «En memoria» al final; "¿Tienes otra mascota?".
- [x] M6 · Ficha (pestaña Resumen; Historial y Documentos llegan en M3): edad, peso y sexo, gráfico de peso de 6 meses descrito en texto ("Subió 0,6 kg en 3 meses, de 27,8 a 28,4 kg…") con su propio error y Reintentar, datos clave. "Tamaño" no existe en la API: no se muestra.
- [x] M21 · Nueva mascota en 2 pasos (React Hook Form + Zod con las reglas de la API): Perro/Gato/Otro (Otro muestra conejo, ave, reptil, roedor, pez u otro), raza con sugerencias locales y texto libre, fecha dd/mm/aaaa con teclado numérico. 422 → error en su campo (vuelve al paso 1 si hace falta).
- [x] Foto: galería sin permiso; cámara con una hoja que explica el permiso antes de pedirlo y "Abrir Ajustes" si está bloqueado. Se reduce a 1200 px y se re-codifica en JPEG 0,8 antes de subir (sin metadatos; la API además quita EXIF y GPS). Si la subida falla, la mascota ya quedó guardada: "Reintentar subir la foto" o "Seguir sin foto".
- [x] Editar: envía solo lo que cambió (PATCH); la foto se cambia o se quita al momento. Eliminar con confirmación (409 si tiene citas activas, con el mensaje de la API).
- [x] Fallecimiento, aparte al final de Editar: pantalla con textos cuidadosos, fecha (hoy por defecto; ni futura ni antes del nacimiento) y confirmación; la ficha muestra «En memoria · fecha». "Corregir: no ha fallecido" con confirmación. Los recordatorios se detienen en la API (#18).
- [x] Sin conexión con datos guardados: al abrir sin red con una sesión de menos de 24 h, entra a las pestañas con las mascotas guardadas, el aviso "Sin conexión · datos de hace…" y Reintentar; agregar, editar y eliminar quedan deshabilitados. Del usuario solo se guarda el nombre (y el id que liga la caché a su cuenta). La caché (solo consultas de mascotas) vence a las 24 h; cerrar sesión la borra junto con la mascota seleccionada.
- [x] Perfil: acceso a "Mis mascotas". Pestaña Carnet: nombra a la mascota seleccionada hasta M3.
- [x] Pruebas: 210 (Inicio, Mis mascotas, Ficha, Nueva mascota con foto y cámara, Editar, Eliminar, Fallecimiento, sin conexión y cierre de sesión con MSW; lógica de edad, peso, saludo, fecha, razas, formulario; contraste AA de los colores nuevos).
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npx expo install --check`, `npx expo-doctor` (20/20) y el bundle de Android (`expo export`) en verde.

Correcciones tras la primera prueba en Android (Expo Go):
- [x] Pantalla roja al elegir el sexo en Nueva mascota: el `shadow-sm` que el Segmented agregaba al seleccionar usa variables CSS; NativeWind tenía que remontar el componente y su aviso de desarrollo, al serializar los hijos, chocaba con el contexto de navegación. Lo que cambia al seleccionar va ahora en `style` con tokens (Segmented, Toggle, Chip, Checkbox, barra de pestañas, selectores de especie y de mascota, medidor de contraseña). Pruebas con NativeWind real: cambiar de estado no remonta, y ninguna clase de ese tipo es condicional en el código.
- [x] El teclado tapaba los campos: `react-native-keyboard-controller` (`KeyboardAwareScrollView`) en todos los formularios (Crear cuenta, Iniciar sesión, Recuperar, código, confirmar correo, Nueva mascota, Editar, Fallecimiento); el botón principal queda encima del teclado y "Siguiente" pasa de campo en campo.
- [x] `unstable_settings.anchor` en lugar de `initialRouteName` (obsoleto) en `(auth)`.

- [x] Prueba intermitente de cerrar sesión: la causa era un `waitFor` con callback async. Con los timers falsos, el callback podía resolver mientras el `act()` de `waitFor` seguía abierto; la prueba seguía con otro `act()` encima y React dejaba sin aplicar la redirección a la Bienvenida. Reproducido a propósito (3 de 3) y corregido con lecturas sincrónicas del mock de AsyncStorage; sin tiempos extra.

Cierre (2026-11-20):
- [x] Probada en Android con Expo Go: selector de sexo, teclado en todos los formularios, "Siguiente", interruptores y casilla de la política. M2 terminada.

Notas:
- La caché se guarda con `@tanstack/react-query-persist-client` en AsyncStorage, un persister por sesión (su throttle guarda estado) que deja de escribir al cerrar sesión.
- Jest: TanStack avisa a las pantallas con un `setTimeout(0)`, que con `renderRouter` es falso; si una prueba lee la caché directamente, avanzar los timers antes de tocar la pantalla.

## ✅ M3 · Pasaporte PetCat (pieza principal)

- M7 tarjeta Pasaporte: degradado, brillo holográfico que reacciona al giroscopio (Reanimated + expo-sensors; desactivado con "Reducir movimiento"), foto, número `PC-AAAA-NNNNN`, microchip, QR, línea tipo MRZ.
- Pila deslizable cuando hay varias mascotas.
- Anillo de estado de vacunas y **sellos** (aplicada / pendiente), con texto accesible.
- M8 línea de vida con filtros (vacunas, desparasitación, consultas), del más reciente al más antiguo.
- Botones Compartir y PDF visibles pero deshabilitados con "Próximamente" hasta M7.
- Pruebas: cálculo de estado de vacunas, lectura completa con lector de pantalla (etiquetas).

### Resultado de M3 (rama `mobile/m3-pasaporte`)

Backend primero: PR #20 (`api/pasaporte`, fusionado). Número del pasaporte `codigo_pasaporte` (`PC-XXXX-XXXX`, aleatorio y estable, migración 030; no sale del id) y `tipo` del historial con varios valores. Además: `npm run db:verificar` y copias con `mysqldump --routines`.

Decisiones del plan (aprobadas): número aleatorio de la API en lugar de `PC-AAAA-NNNNN` derivado del id; sin QR en la tarjeta hasta M7 (en su lugar, un emblema decorativo); sin insignia "Verificado" (el origen va por vacuna: "Registrada por Clínica X" o "por ti"); "6 de 6 vacunas al día" en lugar de "esquema completo" (la app no conoce el esquema de cada especie); efecto con `useAnimatedSensor` de Reanimated en lugar de expo-sensors; sin red se guardan vacunas y última desparasitación, no las consultas (Ley 1581); los Documentos de la ficha pasan a M6.

Hecho:
- [x] M7 · Tarjeta: degradado, foto, nombre, número, estado de salud, especie, nacimiento, microchip en bloques de tres y línea tipo pasaporte (decorativa; el microchip va completo y se recorta el nombre o la raza). «En memoria»: tarjeta lavanda con la fecha. Sin alto fijo: con texto grande (`fontScale ≥ 1,3`) los datos van en una columna.
- [x] Lector de pantalla: la tarjeta es un solo elemento con todo en texto (el número deletreado por grupos, el microchip en bloques). Con varias mascotas, la pila es un control ajustable ("Mascota 1 de 2"; deslizar arriba o abajo cambia y anuncia el nombre). Emblema, brillo, línea tipo pasaporte y puntos de página, ocultos.
- [x] Pila deslizable (FlatList paginada): llega con la mascota de Inicio y al cambiar actualiza la selección (solo las vivas). Vivas primero, luego «En memoria».
- [x] Sellos: la dosis vigente de cada vacuna (las anteriores no) y la última desparasitación. Aplicada (✓, fecha), próxima (reloj de arena, "Vence 12 dic", sol), vencida (alerta, "Venció…", borde continuo); cada sello se lee completo con su origen. «En memoria»: en gris, sin alertas.
- [x] Anillo "N/M": vacunas vigentes no vencidas, con el próximo refuerzo o la vencida y desde cuándo.
- [x] Brillo fijo en la tarjeta. El efecto holográfico (sensor y giro 3D) está construido pero **pausado** (`EFECTO_HOLOGRAFICO = false` en `features/pasaporte/efecto.tsx`): ver "Pendiente: efecto holográfico del Pasaporte" más abajo.
- [x] Compartir con QR y PDF visibles pero claramente no disponibles: sin relleno, borde apagado y "Próximamente" dentro del botón (también para el lector, como deshabilitados).
- [x] M8 · Línea de vida (`/mascotas/[id]/linea-vida`, desde el Pasaporte y la ficha): filtros Todo, Vacunas, Desparasitación y Consultas; "Próximo" arriba; del más reciente al más antiguo con separadores por año; 20 por página con "Cargar más" (las vacunas, completas, se intercalan sin reordenar al cargar más); la vacunación que una vacuna enlaza no se repite; al tocar un registro, diagnóstico, tratamiento, indicaciones y próximo control.
- [x] Sin red: el Pasaporte completo con la caché; la línea de vida con vacunas y la última desparasitación, y el aviso de que las consultas necesitan conexión.
- [x] Pantalla de desarrollo "Sensor del Pasaporte" (Perfil y ruta `/dev/sensor`, solo con `__DEV__`; fuera de desarrollo la ruta lleva a Inicio) para comprobar el sensor en el teléfono.
- [x] Ajustes de la primera prueba en el teléfono: sellos en cuadrícula de 3 columnas alineada a la izquierda, con el nombre completo de la vacuna debajo del círculo (antes "PARVOVIR.", "ANTIRRÁB."); el círculo de los sellos es SVG y sin giro (los bordes punteados con `borderRadius` y `rotate` dan problemas en Android); "Ver línea de vida" como enlace en color de acento con flecha; la etiqueta "Carnet" de la barra se veía cortada: la columna del botón central tenía `flex: 1` (base 0) y no aportaba su alto a la barra.
- [x] Pruebas: 296 (pasaporte y línea de vida con MSW, lógica de sellos, anillo, etiquetas y línea de vida, contraste AA de los colores nuevos sobre el fondo oscuro). Contrato comprobado contra la demo.
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npx expo install --check`, `npx expo-doctor` (20/20) y el bundle de Android en verde.

Cierre (2026-11-20):
- [x] Probada en Android con Expo Go, con el efecto pausado: sin cierres en unas 10 aperturas, con y sin "Quitar animaciones"; sellos, botones Compartir y PDF, enlace "Ver línea de vida" y etiqueta "Carnet" bien. M3 terminada.

Queda para después (no bloquea M3):
- [ ] Maestro: `e2e/pasaporte.yaml` (pendiente de instalar Maestro, como en M1).
- [ ] **Efecto holográfico del Pasaporte (pausado por cierres nativos en Android).** Lo que se sabe:
  - Síntoma: en la primera prueba en Android (Expo Go, SDK 58) la app se cerró sola en el Pasaporte, también con "Quitar animaciones" activado. No hay registro del cierre (no se capturó `adb logcat`), así que la causa no está confirmada.
  - El código: `useInclinacion` (`useAnimatedSensor` de Reanimated 4.7, gravedad a ~30 Hz) y el giro 3D con `withSpring` dentro de `useAnimatedStyle`, solo en la tarjeta del frente, con la pestaña visible y la app en primer plano. No se llegó a confirmar en el teléfono que el sensor entregue lecturas (pantalla "Sensor del Pasaporte").
  - Por qué "Quitar animaciones" no lo evitaba: `useReducirMovimiento` empezaba en `false` hasta que Android respondía, así que en el primer render el sensor se montaba y se desmontaba enseguida. Un registro y baja del sensor casi simultáneos es una causa posible. Corregido: `Holograma` espera la respuesta (`useReducirMovimientoConocido`) antes de montarlo.
  - También se quitaron del Pasaporte otros riesgos nativos, aunque no se confirmó que causaran el cierre: el brillo fijo ya no usa `Animated.View` de Reanimated (solo `View` y `LinearGradient`), y los sellos dejaron de usar borde punteado con `borderRadius` y `rotate` (ahora SVG). La pila nunca usó gesture-handler ni Reanimated: es un `FlatList` horizontal paginado.
  - Para retomarlo: `EFECTO_HOLOGRAFICO = true`; probar primero en un development build y no solo en Expo Go; capturar el cierre con `adb logcat` (en PowerShell: `adb logcat *:E | Select-String "FATAL|AndroidRuntime|reanimated|worklets"`); comprobar el sensor con la pantalla "Sensor del Pasaporte"; si el problema es el sensor de Reanimated, cambiar `useInclinacion` por expo-sensors (`DeviceMotion` o `Gravity`) con las mismas reglas (solo con foco, ~30 Hz, apagado con "Reducir movimiento"). Las pruebas del efecto activo (sensor solo con la pestaña visible y sin "Reducir movimiento") se reemplazaron por la del efecto pausado: hay que volver a escribirlas.

Notas:
- Jest: Reanimated tiene un mock propio (`test/reanimatedMock.tsx`, por `moduleNameMapper`): el oficial carga la librería real y falla sin el runtime nativo, y `expo-router/testing-library` registra el suyo encima.

## ✅ M4 · Explorar y negocios

- M10 mapa con MapLibre (requiere development build): pines por categoría con calificación, agrupación, mi ubicación (permiso explicado antes de pedirlo), filtros, carrusel inferior sincronizado con los pines, "Ver lista" accesible como alternativa al mapa.
- "Cómo llegar" abre Google Maps/Waze con la coordenada.
- M11 perfil del negocio: servicios con precio, reseñas, información.
- Teselas configurables (`EXPO_PUBLIC_MAP_TILES_URL`, atribución visible "© OpenStreetMap").

### Resultado de M4 (rama `mobile/m4-explorar`)

Backend primero: PR #22 (`api/explorar`, fusionado): la sucursal cercana de `GET /negocios` trae coordenadas y si está abierta ahora (`abierto_ahora`, `cierra_a`, `abre_hoy_a`), filtro `abierto_ahora` y `tipo` con varios valores. Pendiente en la API: los festivos de Colombia.

Decisiones (entrega cercana, aprobadas): sin MapLibre por ahora (requiere development build): Leaflet + OpenStreetMap dentro de `react-native-webview`, que funciona en Expo Go, como el panel web. Fuera de M4: agrupar pines, ruta punteada, carrusel sincronizado y animaciones. Agendar abre el perfil; en el perfil, "Agendar cita · Próximamente" deshabilitado hasta M5 (sin botón por servicio). Sin ubicación, el mapa centra en Sincelejo y no muestra distancias.

Hecho:
- [x] Módulo del mapa (`src/features/explorar/mapa/`): la pantalla solo conoce `<MapaNegocios>`; el WebView, el HTML y el protocolo de mensajes viven ahí, para cambiar a MapLibre sin tocar la pantalla. Mensajes en JSON en los dos sentidos; lo que llega del WebView se valida con Zod.
- [x] Leaflet 1.9.4 empaquetado en la app (`npm run mapa:leaflet` genera `leaflet.generado.ts` desde `node_modules`, con el aviso de licencia BSD-2), sin CDN.
- [x] Seguridad del WebView: solo carga su página (los enlaces, como la atribución, se abren fuera); CSP sin red salvo las imágenes del origen de `EXPO_PUBLIC_MAP_TILES_URL`. Probado en Chrome con Playwright: las teselas del origen configurado cargan, las imágenes de otros orígenes se bloquean sin pedirse, las etiquetas y la atribución van escapadas y, si el servidor niega las teselas, el mapa avisa.
- [x] Si el mapa no carga (sin "listo" en 10 s, error del WebView o teselas que no cargan): pasa a la lista con un aviso y "Reintentar mapa". Nunca queda en blanco sin decir nada.
- [x] M10 · Explorar: pines por categoría con la calificación (o "Nuevo"), el seleccionado destacado, mi ubicación; búsqueda (con espera de 400 ms) y chips Abierto ahora, Veterinarias (veterinaria y clínica) y Peluquería; tarjeta inferior con nombre, calificación, distancia, abierto o cerrado, Agendar (abre el perfil) y Cómo llegar (Google Maps o Waze con la coordenada).
- [x] "Ver lista": la misma información en una lista accesible; también es lo que se ve si el mapa falla.
- [x] Ubicación (`expo-location`, solo con la app abierta): una hoja explica para qué antes de pedir el permiso; si lo niega, Sincelejo con "Mostrando Sincelejo · Usar mi ubicación"; bloqueado, el botón ofrece abrir Ajustes.
- [x] M11 · Perfil del negocio (`/negocios/[id]`): "Verificado por PetCat" (si la API lo marca), calificación, distancia (si ya hay permiso de ubicación) y abierto o cerrado; pestañas Servicios (precio, oferta, duración, "Desde"), Reseñas (paginadas, con la respuesta del negocio) e Información (horario de lunes a domingo por sede, Cómo llegar, Llamar, WhatsApp y sitio web).
- [x] Accesibilidad: el mapa es solo visual (oculto al lector, con "Mapa con N negocios. Para recorrerlos con el lector de pantalla, usa Ver lista"); cada negocio es un elemento con todo en texto y sus acciones aparte; al tocar un pin se anuncia el negocio.
- [x] Pruebas: 326 (Explorar y perfil con MSW y el WebView simulado; lógica de filtros, textos, horario, precios, enlaces, mensajes del mapa, CSP y navegación; contraste de los colores nuevos).
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npx expo install --check`, `npx expo-doctor` (20/20) y el bundle de Android en verde.

Cierre (2026-11-20):
- [x] Probada en Android con Expo Go: el mapa carga con las teselas de OpenStreetMap, pines, ubicación (concedida y negada), tarjeta, Cómo llegar, filtros, lista y perfil, sin cierres. M4 terminada.

Notas:
- `react-native-webview` 14.0.1 tipa mal su clase (`WebView<P = undefined>` con props `WebViewProps & P`, que con TypeScript estricto es `never`): `MapaNegocios.tsx` usa un alias bien tipado del mismo componente.

## ✅ M5 · Reservas y citas

- M12 agendar: mascota, servicio, días con disponibilidad, franjas (ocupadas tachadas + etiqueta), resumen fijo abajo.
- M13 confirmación (confeti respetando "Reducir movimiento"), añadir al calendario del teléfono.
- M17 mis citas: próximas/pasadas, reprogramar, cancelar, cómo llegar.
- Actualización en vivo con Socket.IO (`agenda_actualizada`).
- Maestro: agendar cita de punta a punta.

### Resultado de M5 (rama `mobile/m5-citas`)

Sin cambios en el backend: la API ya tenía horas libres, reservar, mis citas, detalle, cancelar y reprogramar (el dueño, hasta 2 horas antes). La demo ya tiene horas libres en los próximos 14 días (horarios semanales y citas con fechas relativas a `CURDATE()`), así que el seed no cambió.

Decisiones (entrega cercana, aprobadas): solo se muestran las horas libres, sin las ocupadas tachadas (la API no las da; si no hay ninguna, el `motivo_sin_horarios` de la API); sin puntos de disponibilidad por día (serían 14 consultas); reprogramar sí entra; sin Socket.IO: las citas se piden de nuevo al volver a la pantalla y al deslizar hacia abajo; sin "Añadir al calendario" ni la tarjeta "Sin agendar" del mockup.

Hecho:
- [x] M12 · Agendar (`/negocios/[id]/agendar?servicio=`): mascota (las que el servicio no atiende por especie, deshabilitadas con el motivo; el peso lo valida la API), servicio con "Cambiar", sede si hay varias, 14 días (los que la sede no abre dicen "Cerrado") y horas libres en Mañana, Tarde y Noche; resumen fijo abajo con "Confirmar cita". Se abre desde el perfil (abajo y en cada servicio) y desde la tarjeta del mapa.
- [x] 409 al confirmar: "Esa hora se acaba de ocupar. Elige otra de las horas libres." (o el mensaje de la API en otros conflictos), anunciado al lector, y se vuelven a pedir las horas libres. 422 de la mascota junto a la mascota. Sin respuesta: no se reintenta solo (podría duplicar la cita) y pide revisar Mis citas.
- [x] M13 · Confirmación (`/cita/[id]/confirmada`): "¡Cita agendada!", "¡Solicitud enviada!" si el negocio debe confirmarla, o "¡Cita reprogramada!"; ticket y consejos. Confeti con `Animated` de React Native (sin Reanimated), solo sin "Reducir movimiento".
- [x] M17 · Mis citas (pestaña Citas): Próximas y Pasadas, agrupadas en "Esta semana" y por mes; estado en texto; Cómo llegar, Reprogramar (hasta 2 horas antes) y Cancelar con confirmación (avisa si será cancelación tardía). Detalle de la cita (`/cita/[id]`) con el aviso de confirmación pendiente y quién canceló.
- [x] Reprogramar (`/cita/[id]/reprogramar`): la misma pantalla de agendar con la mascota, el servicio y la sede de la cita.
- [x] Inicio: la próxima cita abre su detalle.
- [x] Accesibilidad: mascotas, días y horas como grupos de radios con su estado; cada cita es un botón con todo en la etiqueta y sus acciones aparte; contraste AA de los colores de estado.
- [x] Pruebas: 369 (flujo completo, 409, sin red, día sin horas, mascotas no compatibles, sedes, reprogramar, cancelar tardía, Mis citas vacía y con error, Inicio; lógica de días, horas, reglas de 2 horas y grupos). Prueba de humo contra backend-demo: reservar, 409 en la misma hora, mis citas, detalle sin notas internas, reprogramar y cancelar.
- [x] Maestro: `e2e/agendar-cita.yaml` (agenda y cancela, para dejar la demo igual). Escrito, sin correr todavía.

Cierre (2026-11-20):
- [x] Probada en Android con Expo Go: agendar desde el perfil, desde un servicio y desde el mapa; confirmación; reprogramar; cancelar (con el aviso de cancelación tardía); el 409; Inicio abre el detalle. La cita aparece en vivo en la agenda del panel. M5 terminada.

Pendientes:
- [ ] Tiempo real con Socket.IO (`agenda_actualizada`, `cita_confirmada`): hoy se refresca al volver a la pantalla y al deslizar.
- [ ] Horas ocupadas tachadas (requiere que `GET /citas/horarios-libres` las devuelva) y puntos de disponibilidad por día.
- [ ] "Añadir al calendario" del teléfono y la tarjeta "Sin agendar" sugerida por el pasaporte.

## ⬜ M6 · Notificaciones y perfil

- Registro del token de Expo Push; recordatorio un día antes; abrir la pantalla correcta al tocar la notificación.
- M18 bandeja de notificaciones (leídas/no leídas, tiempo real).
- M19 perfil y privacidad: `compartir_historial`, ubicación, descargar mis datos (si la API lo tiene; si no, marcar como pendiente de Ley 1581), eliminar cuenta, texto grande.
- M20 calificar visita (reseñas).
- Documentos de la ficha (pestaña de M6 · Ficha): imágenes y PDF del historial (`archivos`, URL firmada que vence), visor y descarga. Pasó de M3 a esta fase (plan de M3, noviembre 2026).

## ⬜ M7 · Compartir pasaporte — requiere API nueva

**Backend primero (fase A1):**
- Enlace público temporal: token aleatorio con expiración (1 h / 24 h / 7 d) y alcance (vacunas, datos básicos, historial), revocable, sin exponer ids internos. Respeta `compartir_historial`.
- Página pública mínima que muestre el carnet al escanear el QR (puede vivir en `frontend/web`).
- PDF del carnet.

**App:** M9 hoja de compartir con QR, duración, alcance, WhatsApp, copiar enlace, revocar.

## ⬜ M8 · Eventos — requiere API nueva

**Backend primero (fase A2):**
- Entidad `eventos`: negocio, título, tipo (vacunación, adopción, esterilización, charla, otro), fecha y franja, lugar/coordenadas, cupos, público objetivo, precio (0 = gratis), estado.
- Inscripción por mascota (un cupo por mascota), cancelación, lista de espera opcional ("avisarme si se libera").
- Pantalla simple en el panel web para crear y ver inscritos.

**App:** M14 lista con filtros y barra de cupos, M15 detalle con inscripción en un toque, eventos en el inicio y en el mapa.

## ⬜ Después · Recomendaciones (M16)

Depende de inventario (Fase 3) e IA (Fase 4). Versión inicial posible con reglas: vencimientos de desparasitación y vacunas + tiendas cercanas.

## Antes de publicar en tiendas

- Proveedor de teselas para producción (las teselas públicas de OSM no se permiten para apps en producción).
- Política de privacidad pública y enlace en la ficha de la tienda.
- Página pública de la política de tratamiento de datos (texto revisado) y configurar su dirección en `configuracion_global.politica_datos_url`. Hasta entonces la app muestra un resumen provisional (`src/features/auth/PoliticaScreen.tsx`), que hay que reemplazar.
- Universal links / App Links para los enlaces de los correos (abrir la app directo): dominio con HTTPS que sirva `apple-app-site-association` y `assetlinks.json`, y la app firmada. Hoy la app usa el código de 6 dígitos del correo.
- Íconos, splash, nombre del paquete (`co.petcat.app` o el que definan).
- Cuenta de Google Play (pago único) y Apple Developer (anual) si se publica en iOS.
- SMTP real para correos de recuperación.
