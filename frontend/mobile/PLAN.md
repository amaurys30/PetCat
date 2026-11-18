# PetCat · App móvil — Plan de trabajo

Marca `[x]` al terminar cada tarea. Las convenciones están en `frontend/mobile/CLAUDE.md`. Las fases se llaman M0, M1… (ramas `mobile/m<N>-*`); las pantallas se citan con su nombre del diseño ("M3 · Iniciar sesión").

Las fases M1 en adelante son una propuesta: antes de empezar cada una se revisan las pantallas y la API y se muestra el plan para aprobación.

---

## M0 — Cimientos (`mobile/m0-cimientos`)

**Entorno**

- [x] Proyecto Expo SDK 58 (RN 0.88) con TypeScript estricto y Expo Router en `src/app`, alias `@/`.
- [x] Identidad: nombre PetCat, paquete y bundle `co.petcat.app`, scheme `petcat`. `eas.json` con perfiles `development`, `preview` y `production`, sin `projectId` (Amaurys crea la cuenta y corre `eas init`).
- [x] API de demo alcanzable desde el teléfono: `DEMO_BIND` en `docker-compose.yml` (cerrada por defecto) y alternativa por USB con `adb reverse`; documentado en el README.
- [x] ESLint (`eslint-config-expo` + `react-native-a11y` con `@eslint/compat`), Prettier, Jest (jest-expo) + Testing Library.
- [x] CI: job `app-movil` en `tests.yml` (typecheck, lint, tests, `expo install --check`, bundle de Android).
- [x] `CLAUDE.md` de la raíz remite a este proyecto; capturas del diseño en `docs/mockups/`, ignoradas por git.
- [x] `npx expo install --check` y `npx expo-doctor` sin problemas.

**Sistema de diseño**

- [x] NativeWind 4 con los tokens de la guía visual en `src/theme/tokens.js` (verificado: el bundle compila con RN 0.88 y una prueba confirma que las clases se vuelven estilos).
- [x] Plus Jakarta Sans (cinco pesos) cargada antes de ocultar el splash.
- [x] Componentes base `Texto` y `Boton`.

**Infraestructura**

- [x] Resolución de la URL de la API (`EXPO_PUBLIC_API_URL` o IP del servidor de Expo + 3001), cliente Axios con errores normalizados (`ApiError`), TanStack Query.
- [x] Pantalla de diagnóstico (solo desarrollo): URL de la API y `GET /health`.

**Pantallas**

- [x] M1 · Bienvenida, estática (el carrusel llega en M1). "Crear mi cuenta" y "Ya tengo cuenta" llevan a marcadores.
- [ ] Probar en un teléfono con Expo Go contra la API de demo (Amaurys).

## M1 — Acceso y sesión

- [ ] Sesión: access token en memoria, refresh token en `expo-secure-store`, renovación única ante un 401, cierre de sesión. Zustand.
- [ ] M1 · Bienvenida con el carrusel de tres láminas.
- [ ] M2 · Crear cuenta (con aceptación de la política de datos) y verificación de correo.
- [ ] M3 · Iniciar sesión; recuperar contraseña.
- [ ] Rutas protegidas y navegación principal (pestañas).

## M2 — Mascotas y salud

- [ ] M4 · Inicio.
- [ ] M5 · Mis mascotas · M21 · Agregar mascota (foto en JPEG con `expo-image-manipulator`).
- [ ] M6 · Ficha de la mascota · M8 · Línea de vida.
- [ ] M7 · Pasaporte PetCat (carnet de vacunas y desparasitaciones).

## M3 — Explorar y citas

- [ ] M10 · Explorar (mapa con MapLibre + OpenStreetMap, pines agrupados; necesita development build) · M11 · Perfil del negocio ("Cómo llegar" abre Google Maps o Waze).
- [ ] M12 · Agendar cita · M13 · Cita confirmada · M17 · Mis citas (cancelar y reprogramar).
- [ ] M20 · Calificar visita.

## M4 — Notificaciones y perfil

- [ ] Push con Expo (development build, `projectId` de EAS) y registro del dispositivo en la API.
- [ ] M18 · Notificaciones · M19 · Perfil y privacidad.

## Después (dependen de la API)

- [ ] M9 · Compartir pasaporte — falta en la API (ver Pendientes).
- [ ] M14 · Eventos cerca de ti · M15 · Detalle del evento — falta en la API.
- [ ] M16 · Recomendaciones — reglas simples primero (vencimientos de desparasitación y tiendas cercanas); tiendas y productos en la Fase 3 del backend, IA en la Fase 4.

---

## Pendientes de API

Tomados de "Notas para desarrollo (app)". Se confirman contra Swagger al llegar a cada fase.

- Pasaporte: enlace público temporal con QR (token con expiración y alcance: vacunas / datos / historial) y PDF del carnet. El número `PC-AAAA-NNNNN` puede derivarse del id de la mascota.
- Eventos: entidad pública (título, tipo, fecha, lugar, cupos, público objetivo, precio) y reserva de cupo por mascota; pantalla simple en el panel para crearlos.

## Decisiones

- Expo SDK 58 con Expo Go para M0–M2; development build (EAS) desde la fase que use MapLibre o push remotas.
- NativeWind 4 (no la rc de la 5). Tokens en un archivo JS compartido por Tailwind y el código, para poder volver a `StyleSheet` sin perderlos.
- Jest en lugar de Vitest: jest-expo trae los mocks de los módulos nativos.
- `eslint-plugin-react-native-a11y` declara soporte hasta ESLint 8: se instala con un `overrides` en `package.json` y se adapta con `@eslint/compat`. La regla `has-accessibility-hint` está apagada (las pistas son opcionales).
- La app usa la API de demo (`backend-demo`, 3001). Desde el teléfono: `DEMO_BIND=0.0.0.0` + regla de firewall para redes privadas, o `adb reverse` por USB. La URL se deduce de la IP del servidor de Expo.
