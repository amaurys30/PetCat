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

## 🟨 M0 · Base del proyecto

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
- [x] Expo SDK 58 (RN 0.88.1, React 19.3, TypeScript 6), Expo Router con `app/(tabs)` y `app/(auth)`, `app.config.ts` (`co.petcat.app`, scheme `petcat`), `eas.json` sin `projectId`.
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

Falta:
- [ ] Volver a probar en el teléfono la corrección de "Volver". Después de eso M0 pasa a ✅.
- [ ] Correr `e2e/navegacion.yaml` con Maestro (no está instalado aquí).
- [ ] Que CI pase en el PR.

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

## ⬜ M1 · Acceso

- M1 bienvenida (carrusel de 3), M2 registro con aceptación de la política (Ley 1581, enlace a la política), M3 login, recuperar contraseña.
- Sesión persistente: al abrir la app, refresh silencioso → pestañas o bienvenida.
- Cerrar sesión borra tokens y caché.
- Caso "mi veterinaria me registró": activar cuenta con "olvidé mi contraseña".
- Pruebas: validaciones, login correcto/incorrecto, refresh en cola. Maestro: login.

## ⬜ M2 · Inicio y mascotas

- M4 inicio: selector de mascota, héroe de mascota, próxima cita, recordatorios, accesos rápidos.
- M5 mis mascotas, M6 ficha (resumen, peso, datos clave), M21 agregar/editar mascota (foto con Cloudinary según la API actual).
- Estados vacíos (usuario sin mascotas → invitar a agregar).

## ⬜ M3 · Pasaporte PetCat (pieza principal)

- M7 tarjeta Pasaporte: degradado, brillo holográfico que reacciona al giroscopio (Reanimated + expo-sensors; desactivado con "Reducir movimiento"), foto, número `PC-AAAA-NNNNN`, microchip, QR, línea tipo MRZ.
- Pila deslizable cuando hay varias mascotas.
- Anillo de estado de vacunas y **sellos** (aplicada / pendiente), con texto accesible.
- M8 línea de vida con filtros (vacunas, desparasitación, consultas), del más reciente al más antiguo.
- Botones Compartir y PDF visibles pero deshabilitados con "Próximamente" hasta M7.
- Pruebas: cálculo de estado de vacunas, lectura completa con lector de pantalla (etiquetas).

## ⬜ M4 · Explorar y negocios

- M10 mapa con MapLibre (requiere development build): pines por categoría con calificación, agrupación, mi ubicación (permiso explicado antes de pedirlo), filtros, carrusel inferior sincronizado con los pines, "Ver lista" accesible como alternativa al mapa.
- "Cómo llegar" abre Google Maps/Waze con la coordenada.
- M11 perfil del negocio: servicios con precio, reseñas, información.
- Teselas configurables (`EXPO_PUBLIC_MAP_TILES_URL`, atribución visible "© OpenStreetMap").

## ⬜ M5 · Reservas y citas

- M12 agendar: mascota, servicio, días con disponibilidad, franjas (ocupadas tachadas + etiqueta), resumen fijo abajo.
- M13 confirmación (confeti respetando "Reducir movimiento"), añadir al calendario del teléfono.
- M17 mis citas: próximas/pasadas, reprogramar, cancelar, cómo llegar.
- Actualización en vivo con Socket.IO (`agenda_actualizada`).
- Maestro: agendar cita de punta a punta.

## ⬜ M6 · Notificaciones y perfil

- Registro del token de Expo Push; recordatorio un día antes; abrir la pantalla correcta al tocar la notificación.
- M18 bandeja de notificaciones (leídas/no leídas, tiempo real).
- M19 perfil y privacidad: `compartir_historial`, ubicación, descargar mis datos (si la API lo tiene; si no, marcar como pendiente de Ley 1581), eliminar cuenta, texto grande.
- M20 calificar visita (reseñas).

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
- Íconos, splash, nombre del paquete (`co.petcat.app` o el que definan).
- Cuenta de Google Play (pago único) y Apple Developer (anual) si se publica en iOS.
- SMTP real para correos de recuperación.
