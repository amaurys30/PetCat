# PetCat · App móvil — Instrucciones para Claude Code

Lee también el `CLAUDE.md` de la raíz (contexto del negocio y de la API). El plan de trabajo de la app está en `frontend/mobile/PLAN.md`: revísalo al iniciar cada sesión y marca las casillas al terminar cada tarea.

## Qué es

La app es para los **dueños de mascotas** (B2C, gratis): registran sus mascotas, llevan el carnet de vacunas y el historial, buscan negocios cercanos, agendan citas, reciben recordatorios y dejan reseñas. Los negocios usan el panel web (`frontend/web`, otro proyecto).

## Fuentes de verdad

1. **API:** Swagger en `http://localhost:3001/api/v1/docs` (API de demo) y la especificación en `/api/v1/docs.json`. En las respuestas todo campo documentado es requerido salvo los `x-opcional` (convención del backend).
2. **Diseño:** capturas en `frontend/mobile/docs/mockups/` (no se suben al repositorio): pantallas `M1 · Bienvenida` a `M21 · Agregar mascota`, `Guía visual de la app` (tokens) y `Notas para desarrollo (app)` (qué falta en la API y reglas de accesibilidad).
3. **Si el diseño y la API no coinciden, manda la API.** No se inventan campos ni datos. Si a una pantalla le falta algo de la API, se anota en "Pendientes de API" en `PLAN.md` y se avisa a Amaurys.

Nombres: las **fases** del plan son M0, M1… (ramas `mobile/m<N>-*`); las **pantallas** del diseño se citan con su nombre completo ("M3 · Iniciar sesión") para no confundirlas.

## Stack (decidido)

- **Expo SDK 58** (React Native 0.88, React 19.3) con **TypeScript** estricto. Siempre `npx expo install <paquete>` (no `npm install`) para que la versión sea la del SDK.
- **Expo Router** con las rutas en `src/app/`.
- **NativeWind 4** (Tailwind 3) con los tokens de `src/theme/tokens.js`. No usar NativeWind 5 (rc). Si NativeWind 4 deja de funcionar en un SDK nuevo, el respaldo es `StyleSheet` con los mismos tokens.
- TanStack Query para todo dato de la API; **Axios** como cliente.
- Íconos **lucide-react-native** (los emojis del diseño son marcadores). Fuente **Plus Jakarta Sans** (`@expo-google-fonts/plus-jakarta-sans`).
- Por llegar, cada uno en su fase: `expo-secure-store` (refresh token), Zustand (sesión), React Hook Form + Zod (formularios), MapLibre + teselas de OpenStreetMap (mapa, igual proveedor que el panel), `expo-notifications` (push), `expo-image-picker` + `expo-image-manipulator` (fotos en JPEG, la API no acepta HEIC).
- Pruebas: **Jest (jest-expo) + Testing Library de React Native**. Vitest no se usa aquí: no corre el código de React Native.
- Lint: `eslint-config-expo` + `eslint-plugin-react-native-a11y` (adaptado a ESLint 9 con `@eslint/compat`). Si el plugin da problemas, se reemplaza por reglas propias.
- **Expo Go** mientras se pueda. MapLibre y las push remotas en Android necesitan una **development build** (EAS): se crea en la fase que las use.

## Tokens de diseño

Un solo archivo, `src/theme/tokens.js`: lo leen `tailwind.config.js` (clases) y el código (degradados, colores de íconos).

| Token                                                                   | Valor                             | Uso                                                                      |
| ----------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `marca`                                                                 | `#14A39A`                         | Decorativo (inicio del degradado, ilustraciones). Nunca con texto encima |
| `primary`                                                               | `#0F7D76`                         | Botones, enlaces, acentos. Texto blanco solo sobre este o más oscuro     |
| `primary-deep`                                                          | `#0B6F69`                         | Final del degradado; texto sobre `primary-soft`                          |
| `primary-soft`                                                          | `#E3F6F3`                         | Fondos de acento, chips                                                  |
| `ink`                                                                   | `#1E2A3B`                         | Texto principal                                                          |
| `muted`                                                                 | `#55667A`                         | Texto secundario                                                         |
| `coral` / `sol` / `lavanda`                                             | `#FF8A65` / `#FFC857` / `#7C5CD6` | Acentos decorativos, no para texto                                       |
| `fondo`                                                                 | `#F6F8F9`                         | Fondo de pantalla                                                        |
| `border`, `danger(-soft)`, `warning-ink`, `warning-soft`, `info(-soft)` | los del panel                     | Bordes y estados                                                         |

Tipografía: clases `font-sans`, `font-medio`, `font-seminegrita`, `font-negrita`, `font-extranegrita` (en Android cada peso es una familia; no usar `font-bold`). Tamaños `text-titulo` (28), `text-seccion` (18), `text-cuerpo` (15), `text-apoyo` (13, mínimo), `text-hero` (40, bienvenida). Radios `rounded-control` (16), `rounded-tarjeta` (20), `rounded-hoja` (28). Degradado de marca en `degradadoMarca`: de la mitad hacia abajo ya es `primary` o más oscuro, y el texto blanco va ahí.

Componentes base en `src/components/ui/`: `Texto` (variantes de la escala, los títulos se anuncian como encabezado) y `Boton` (`primario`, `secundario`, `claro`, `contornoClaro`; estado de carga y deshabilitado sin opacidad).

## Estructura

```
frontend/mobile/
├── CLAUDE.md · PLAN.md · README.md · .env.example · app.json · eas.json
├── docs/mockups/            # capturas del diseño (ignoradas por git)
├── src/
│   ├── app/                 # rutas de Expo Router: archivos finos que importan pantallas
│   ├── api/                 # client.ts (Axios), config.ts y origen.ts (URL), errores.ts, <modulo>.ts
│   ├── features/<modulo>/   # screens/, components/, hooks/ (useXxx con TanStack Query)
│   ├── components/ui/       # Texto, Boton…
│   ├── lib/                 # queryClient.ts, queryKeys.ts, format.ts…
│   └── theme/tokens.js      # tokens (con tokens.d.ts)
└── tests/                   # Jest, misma estructura que src/
```

## Convenciones obligatorias

**Datos y API**

- Las pantallas nunca llaman a Axios. Cada módulo expone funciones en `src/api/<modulo>.ts` y hooks en `features/<modulo>/hooks/`. Las claves de caché salen de `lib/queryKeys.ts`.
- Respuestas `{ success, message, data, meta }`: las funciones devuelven `data` (y `meta` cuando hay paginación).
- Los errores llegan como `ApiError` (`status`, `message`, `errors`; `status 0` = sin conexión). Los mensajes de la API se muestran tal cual. 401 → renovar sesión una vez (llega en M1); 403, 404, 409, 422 por campo, 429 y sin conexión tienen su estado en pantalla.
- Avisos de éxito de una mutación en el `onSuccess` del hook, no en el componente (misma regla y motivo que el panel).
- **URL de la API** (`src/api/origen.ts`): `EXPO_PUBLIC_API_URL` si existe; si no, en desarrollo la IP del computador que sirve el bundle con el puerto 3001 (API de demo). La app se prueba contra `backend-demo` (`petcat_demo`), nunca contra `petcat_db`.
- Variables `EXPO_PUBLIC_*` quedan dentro del bundle: nunca secretos.

**Fechas, horas y dinero:** la API envía `YYYY-MM-DD` y `HH:MM` en hora de Bogotá; no usar `new Date('YYYY-MM-DD')`. Dinero con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.

**Accesibilidad** (guía visual y notas para desarrollo)

- Contraste AA: texto blanco solo sobre `primary` o más oscuro. Nada de opacidad para atenuar texto.
- Áreas táctiles de al menos 48 × 48 (`min-h-12`), separación de 8 entre acciones.
- Texto mínimo 13; se respeta el tamaño de texto del sistema (no usar `allowFontScaling={false}`); los textos largos se envuelven, no se cortan.
- El estado (vacunas, cupos, citas) nunca solo con color: siempre con texto o ícono.
- Cada elemento interactivo lleva `accessibilityRole` y una etiqueta; los íconos interactivos, `accessibilityLabel`. Lo decorativo se oculta (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`).

**Interfaz:** textos en español, tuteo, como en los mockups. Cada pantalla contempla carga, vacío, error y sin conexión.

## Forma de trabajar

- Una rama por fase (`mobile/m0-cimientos`, `mobile/m1-acceso`…) y un PR a `main` al cerrarla. Un commit por tarea lógica, en español (`feat(app/mascotas): carnet de vacunas`).
- Antes de cada fase: revisar las pantallas y los endpoints en Swagger, y **mostrar el plan para aprobación**.
- Después de cada cambio: `npm run typecheck`, `npm run lint`, `npm test`, y verlo funcionando en Expo Go contra la API de demo. Al cambiar dependencias, `npx expo install --check` y `npx expo-doctor`.
- `ios/` y `android/` no existen (se generan): la configuración nativa va en `app.json` y los plugins.
- No leer ni modificar el `.env` de la raíz ni `backend/.env`.
- La terminal de Amaurys es PowerShell 5.1: comandos separados con `;`, nunca `&&`.

## Comandos

```powershell
# API de demo (petcat_demo) en Docker, puerto 3001
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile panel up -d --build backend-demo

cd frontend/mobile
npm start                 # servidor de Expo: escanear el QR con Expo Go (misma wifi)
npm run start:usb         # por USB con adb reverse (ver README)
npm run typecheck; npm run lint; npm test
npx expo install --check; npx expo-doctor
```

Detalle de cómo probar en el teléfono en `frontend/mobile/README.md`. En desarrollo, "Diagnóstico de la conexión" (al pie de la bienvenida, ruta `/dev/estado`) muestra la URL de la API y si responde.
