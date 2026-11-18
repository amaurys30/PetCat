# CLAUDE.md — PetCat App móvil (dueños de mascotas)

Este archivo guía a Claude Code dentro de `frontend/mobile/`. Léelo completo antes de cada fase.
Las reglas de la raíz del repositorio (`/CLAUDE.md`) también aplican.

## 1. Qué es

App para **dueños de mascotas** en Sincelejo (B2C). Complementa el panel web de negocios (`frontend/web/`)
y consume la misma API (`backend/`, Express 5, `/api/v1`).

Lo que hace el usuario en la app:
- Ver y administrar sus mascotas.
- **Pasaporte PetCat**: carnet digital de vacunas y desparasitaciones (pieza central de la app).
- Explorar veterinarias, peluquerías y tiendas en un mapa.
- Agendar, reprogramar y cancelar citas.
- Recibir recordatorios y notificaciones.
- Inscribirse a eventos de veterinarias (jornadas de vacunación, adopción…).
- Ver recomendaciones para su mascota (fases posteriores).

Idioma de la interfaz: **español (Colombia)**. Zona horaria: `America/Bogota`.
Formatos: dinero `$45.000` (COP, sin decimales), fechas `vie 15 nov`, horas `8:30 a. m.`.

## 2. Diseño (fuente de verdad: Figma)

- Archivo: `https://www.figma.com/design/AXEbm1XsESvYf2S2W7oRUj/` → página **"App móvil · Dueños de mascotas"** (`188:3004`).
- Guía visual: nodo `188:3071`. Notas para desarrollo: nodo `195:3262`.
- Cada pantalla tiene código M1…M21 (ver `PLAN.md`). Si tienes el MCP de Figma, consulta el nodo antes de construir la pantalla.
  Sin MCP, usa las capturas de `frontend/mobile/docs/mockups/` (ignoradas por git).
- Los **emojis de la maqueta son marcadores**: en código se reemplazan por íconos de `lucide-react-native` (o SVG propios) con etiqueta accesible.
  Excepción: el avatar de la mascota sin foto puede usar una ilustración por especie.

### Tokens

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#14A39A` | Decorativo: fondos, degradados, íconos grandes. **Nunca texto blanco encima** |
| `primary-strong` | `#0F7D76` | Botones principales, texto sobre blanco, texto blanco encima (AA) |
| `primary-deep` | `#0B6F69` | Texto sobre `primary-soft`, final de degradados |
| `primary-soft` | `#E3F6F3` | Fondos suaves, estado activo de pestañas |
| `ink` | `#1E2A3B` | Texto principal |
| `muted` | `#55667A` | Texto secundario (AA sobre blanco y `#F6F8F9`) |
| `subtle` | `#8A97A6` | Solo placeholders y rótulos decorativos, nunca información esencial |
| `border` | `#E3E8EC` | Bordes |
| `surface` | `#F6F8F9` | Fondo de pantallas |
| `track` | `#EEF2F4` | Segmentados, barras de progreso vacías |
| `coral` | `#FF8A65` / degradado `#FF9E7A→#F0643C` | Acento: botón central Carnet, eventos. Texto encima: `#3A1408` |
| `coral-dark` | `#B5462A` | Texto coral sobre blanco/`#FFEDE6` |
| `sun` | `#FFC857` / soft `#FFF5DC` / texto `#9A5800` | Recordatorios, avisos |
| `lavender` | `#7C5CD6` / soft `#EEE8FB` / texto `#5A3FB0` | IA, gatos, eventos de adopción |
| `info` | `#2F80ED` / soft `#EAF2FE` / texto `#1F5FBF` | "Cómo llegar", estados informativos |
| `danger` | `#D93F44` / soft `#FDECEC` | Errores, cancelar, eliminar |
| `danger-ink` | `#B3262B` | Texto de error y fondo del botón de peligro. `danger` no llega a AA como texto (4,4:1 sobre blanco); se agregó en M0 |
| `passport-bg` | `#0E2A33 → #132F3D` | Fondo oscuro de la pantalla Pasaporte |
| Degradado marca | `#17B5AB → #0B6F69` | Héroes, tarjetas destacadas |

- Tipografía: **Plus Jakarta Sans** (Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800) con `expo-font`.
- Escala: título 28/800, título de sección 18/800, cuerpo 15/400–500, apoyo 13/500, mínimo 11 (solo rótulos).
- Radios: 12 (chips pequeños), 14–16 (botones, inputs), 20–24 (tarjetas), 26 (Pasaporte), 36 (marco).
- Espaciado base 4; padding horizontal de pantalla 20.
- Los tokens viven en **un solo lugar** (`src/theme/tokens.ts`) y se exponen a NativeWind en `tailwind.config.js`. No escribas colores hex sueltos en componentes.
- Con fuentes propias, Android no sintetiza negritas: cada peso es su propia familia. Usa el componente `Text` de `src/components/ui` (o las clases `font-regular`, `font-medium`, `font-semibold`, `font-bold`, `font-extrabold`, que apuntan a la familia de cada peso). No pongas dos de esas clases en el mismo elemento: no gana la última escrita.

## 3. Stack

- **Expo** (SDK estable más reciente) + **React Native** + **TypeScript estricto**.
- **Expo Router** (rutas por archivos, grupos `(auth)` y `(tabs)`).
- **TanStack Query** para datos del servidor; **Zustand** para estado de cliente (sesión, mascota seleccionada).
- **React Hook Form + Zod** para formularios.
- **NativeWind** para estilos (verifica compatibilidad con la versión de Expo antes de instalar).
- **expo-secure-store** para el refresh token.
- **@maplibre/maplibre-react-native** + teselas OSM (URL configurable por variable de entorno).
- **expo-notifications** (Expo Push ya existe en el backend).
- **socket.io-client** (eventos `agenda_actualizada`, `notificaciones`).
- **@react-native-community/netinfo** (desde M1: reintentar el arranque cuando vuelve la red).
- **react-native-reanimated**, **expo-sensors** (efecto holográfico del Pasaporte), **react-native-svg**, **react-native-qrcode-svg**, **expo-image**, **lucide-react-native**.
- **openapi-typescript** para generar tipos desde `GET /api/v1/docs.json`.
- Pruebas: **Jest (jest-expo) + React Native Testing Library + MSW**; E2E con **Maestro**.
  Aquí **no se usa Vitest** (el backend y el panel sí): Vitest no corre el código de React Native, y jest-expo trae los mocks de los módulos nativos.

Versiones de M0: Expo SDK 58 (React Native 0.88, React 19.3, TypeScript 6), NativeWind 4.2 con Tailwind 3 (NativeWind 5 sigue en rc: no se usa), MSW 3.
Dos paquetes declaran dependencias pares viejas y se instalan con `overrides` en `package.json`: `eslint-plugin-react-native-a11y` (ESLint ≤ 8, cargado con `@eslint/compat`) y `openapi-typescript` (TypeScript 5). Si alguno falla, el plugin de a11y se reemplaza por reglas propias.

**Expo Go no basta**: MapLibre y push en Android requieren **development build** (EAS Build, perfil `development`).
Mantén la app compatible con Expo Go hasta M4 cuando sea posible, para facilitar las primeras pruebas.

## 4. Estructura

```
frontend/mobile/
  app/                     # Expo Router
    (auth)/                # bienvenida, registro, login, recuperar
    (tabs)/                # inicio, explorar, carnet, citas, perfil
    mascotas/[id]/…        # ficha, historial, editar
    negocios/[id]/…        # perfil, agendar
    eventos/[id].tsx
  src/
    api/                   # cliente HTTP, interceptores, tipos generados (api-types.ts)
    features/<modulo>/     # hooks de queries, componentes y lógica por módulo
    components/ui/         # Button, Chip, Card, Input, Segmented, Toggle, Avatar, Sheet…
    theme/                 # tokens.ts, fuentes
    lib/                   # formatos es-CO, fechas, utilidades
    store/                 # Zustand
  e2e/                     # flujos Maestro (.yaml)
  test/                    # setup de Jest, handlers de MSW
```

Las pruebas van junto al código que prueban (`*.test.ts(x)` dentro de `src/`), nunca dentro de `app/`: Expo Router trataría el archivo como una ruta.

## 5. Reglas de la API

- **No inventes endpoints.** Antes de cada fase, revisa Swagger (`/api/v1/docs.json`) y las rutas en `backend/src`. Si algo falta, **detente y propón** el cambio en el backend como parte del plan; no lo simules en la app.
- URL base desde `EXPO_PUBLIC_API_URL` (ej. `http://192.168.1.50:3001/api/v1`). Nunca `localhost` en el teléfono.
  Si la variable no está, en desarrollo se usa la IP con la que Expo sirve el bundle más el puerto 3001 (`src/lib/env.ts`); la excepción a "nunca localhost" es el USB con `adb reverse` (ver README).
- **Sesión:** access token solo en memoria (Zustand); refresh token en `expo-secure-store`.
  Interceptor: ante 401, **un solo refresh en curso** (cola de peticiones) y reintento; si el refresh falla, cerrar sesión.
  El refresh rota (cada uso entrega uno nuevo): guarda siempre el nuevo.
  **Verifica primero cómo recibe el backend el refresh token** (cookie vs cuerpo). Si solo acepta cookie, propón el cambio para clientes móviles antes de construir el login.
  (Verificado en M0: llega en el cuerpo, `POST /auth/refresh-token` con `{ refresh_token }`; ver `PLAN.md`.)
- Fechas: la API trabaja en hora de Colombia; muestra siempre en `America/Bogota`, independiente de la zona del teléfono.
- Errores: mensajes en español, cortos y accionables. Nunca mostrar trazas ni códigos internos.
- Regenera los tipos (`npm run api:types`) cuando cambie la API y súbelos en el mismo PR.

## 6. Accesibilidad (obligatoria)

- Contraste **WCAG AA**: texto blanco solo sobre `primary-strong` o más oscuro; nunca sobre `primary` (`#14A39A`).
- Áreas táctiles ≥ **48×48** (usa `hitSlop` si el elemento visual es menor).
- Todo `Pressable` sin texto visible lleva `accessibilityLabel` y `accessibilityRole`. Estados con `accessibilityState` (seleccionado, deshabilitado).
- El estado nunca se comunica solo con color: horas ocupadas tachadas + "Ocupado" para lectores; vacunas con texto "Aplicada / Pendiente".
- Soporta el tamaño de texto del sistema (`allowFontScaling` activo). Limita con `maxFontSizeMultiplier` solo en piezas decorativas (sellos, MRZ del Pasaporte).
- Respeta "Reducir movimiento" (`AccessibilityInfo.isReduceMotionEnabled`): desactiva el efecto holográfico y el confeti.
- Orden de foco lógico; los sheets y modales atrapan el foco y se cierran con el gesto atrás.
- El Pasaporte debe leerse completo con TalkBack/VoiceOver como texto: nombre, número, especie, microchip, estado de vacunas.

## 7. Pruebas

- Cada pantalla nueva: al menos una prueba con RNTL (renderiza, estados vacío/carga/error, acción principal).
- Lógica pura (formatos, cálculo de estado de vacunas, franjas horarias) con pruebas unitarias.
- MSW para simular la API; no dependas del backend real en Jest.
- Flujos críticos con Maestro: login, agendar cita, abrir Pasaporte, compartir QR.
- Lint incluye `eslint-plugin-react-native-a11y` (con `has-accessibility-hint` apagada: las pistas son opcionales en iOS y Android).
- Antes de abrir el PR: `npm run lint`, `npm run typecheck`, `npm test` en verde.
- Jest corre con `TZ=Asia/Tokyo` (`jest.config.js`) para que una fecha que dependa de la zona del equipo falle en las pruebas.
- MSW en Jest: el SDK 58 reemplaza el `fetch` global por `expo/fetch` (un stub en Jest). `test/environment.js` guarda el `fetch` de Node y `test/setup.ts` lo restaura antes de arrancar MSW; MSW 3 usa `onUnhandledFrame` (antes `onUnhandledRequest`).
- Pruebas de flujo con la app real: `renderApp(ruta)` y `reiniciarSesion()` de `test/app.tsx` (todas las rutas, con el arranque y las rutas protegidas). `renderRouter` activa los timers falsos; `jest.config.js` deja `nextTick` y `setImmediate` reales para que las llamadas a la API terminen.
- Formularios: React Hook Form con `Controller` (pasar `field.ref` al campo para el foco) y `useWatch` en lugar de `watch` (React Compiler omite los componentes que usan `watch`).

## 8. Comandos

```
npm run start          # expo start (dev build o Expo Go)
npm run start:usb      # expo start --localhost, para adb reverse (ver README)
npm run android        # abre en emulador/dispositivo Android
npm run lint
npm run typecheck
npm test
npm run api:types      # genera src/api/api-types.ts desde docs.json
npm run e2e            # maestro test e2e/
npx expo install --check; npx expo-doctor   # al cambiar dependencias
```

El equipo usa **Windows + PowerShell 5.1**: no encadenes con `&&` en instrucciones para el usuario (usa `;` o líneas separadas).

## 9. Seguridad y datos (no negociable)

- **Nunca leas ni modifiques `backend/.env` ni el `.env` de la raíz**. No pidas ni pegues secretos (Cloudinary, SMTP, claves de mapas) en el chat.
- No uses `docker compose config` sin filtrar: imprime los valores de los `.env`. Para ver puertos o servicios, `docker compose ps` o `docker compose config --services`.
- `frontend/mobile/.env` **no se sube** al repositorio; mantén `frontend/mobile/.env.example` con nombres de variables sin valores reales.
- Solo variables `EXPO_PUBLIC_*` llegan al cliente: **nunca** pongas secretos en ellas.
- No ejecutes `db:reset` sobre `petcat_db` ni `docker compose down -v`. Para probar usa **backend-demo (puerto 3001, `petcat_demo`)**.
- Datos personales (Ley 1581): no guardes en el teléfono más de lo necesario; el caché de TanStack Query se borra al cerrar sesión.
- La contraseña `2003` del seed es solo para desarrollo.

## 10. Forma de trabajo

1. Al iniciar una fase: lee este archivo, `PLAN.md` y las pantallas de Figma de la fase. **Entrega un plan** (archivos, dependencias, cambios de API, pruebas, preguntas) y **espera aprobación** antes de escribir código.
2. Una rama por fase: `mobile/m<N>-<nombre>`. Commits pequeños en español.
3. PR con: resumen, capturas (o GIF) de las pantallas, cómo probarlo en el teléfono y lista de pendientes.
4. Al cerrar la fase, actualiza el estado en `PLAN.md`.
