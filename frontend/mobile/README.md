# PetCat · App móvil

App para dueños de mascotas (Expo SDK 58, React Native, TypeScript). Convenciones en [CLAUDE.md](CLAUDE.md) y plan en [PLAN.md](PLAN.md).

## Requisitos

- Node 24 y npm.
- Docker con la API de demo (`backend-demo`, puerto 3001, base `petcat_demo`).
- En el teléfono: **Expo Go** de la Play Store o la App Store, en la versión para el SDK 58.

```powershell
cd frontend/mobile
npm install
```

## Probar en el teléfono con Expo Go

La app habla con la API de demo. Por defecto deduce su dirección de la IP con la que Expo sirve el bundle (la que sale en la terminal) más el puerto 3001, así que el teléfono tiene que poder llegar a ese puerto. Hay dos formas.

### Opción B (por wifi): abrir la API de demo a la red local

La API de demo escucha solo en `127.0.0.1` (cerrada a la red). Para abrirla:

1. En el `.env` de la **raíz** del repositorio, agregar `DEMO_BIND=0.0.0.0` y recrear el contenedor:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile panel up -d --build backend-demo
   ```

2. Crear una regla de firewall **solo para redes privadas** (PowerShell como administrador, una sola vez):

   ```powershell
   New-NetFirewallRule -DisplayName "PetCat API demo (3001)" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
   ```

   La red wifi de la casa tiene que estar marcada como **Privada** en Windows (Configuración → Red e Internet → Wi-Fi → la red → Tipo de perfil de red). En una red pública (universidad, café) la regla no aplica y la API sigue cerrada; ahí usar la opción A.

3. Arrancar Expo y escanear el QR con Expo Go (Android) o con la cámara (iPhone), con el teléfono en la misma wifi:

   ```powershell
   cd frontend/mobile; npm start
   ```

   La primera vez Windows puede preguntar si Node.js puede usar la red: permitir solo en redes privadas (Metro, puerto 8081).

Para cerrarla otra vez: quitar `DEMO_BIND` del `.env`, recrear el contenedor y, si se quiere, `Remove-NetFirewallRule -DisplayName "PetCat API demo (3001)"`.

### Opción A (por USB, solo Android): `adb reverse`

No abre nada a la red: el teléfono usa los puertos del computador a través del cable.

1. Activar la depuración USB en el teléfono (Opciones de desarrollador) y conectarlo. `adb` viene con Android Studio (`%LOCALAPPDATA%\Android\Sdk\platform-tools`) o con las Platform Tools sueltas.
2. Redirigir los puertos de Metro y de la API, y arrancar Expo en modo local:

   ```powershell
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:3001 tcp:3001
   cd frontend/mobile; npm run start:usb
   ```

3. En la terminal de Expo, `a` abre la app en Expo Go del teléfono conectado. La redirección se pierde al desconectar el cable: repetir el paso 2.

### Comprobar la conexión

Al pie de la bienvenida, en desarrollo, está **Diagnóstico de la conexión**: muestra la URL de la API y el resultado de `GET /health`. Si dice "Sin conexión", abrir esa URL + `/health` en el navegador del teléfono para separar un problema de red de uno de la app.

Si Expo muestra una IP que no es la de la wifi (por ejemplo `172.x.x.x`, del adaptador de WSL o Docker), el teléfono no carga ni el bundle: indicar la IP de la wifi (`ipconfig`) antes de arrancar:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.50"; npm start
```

### Otra dirección

Para apuntar a otra API (túnel, otro equipo), copiar `.env.example` a `.env.local` y definir `EXPO_PUBLIC_API_URL`. Con `npx expo start --tunnel` es obligatorio: el túnel de Expo solo lleva el bundle, no la API.

## Comandos

```powershell
npm start                    # servidor de Expo (wifi)
npm run start:usb            # servidor de Expo para adb reverse
npm run typecheck            # TypeScript
npm run lint                 # ESLint, con reglas de accesibilidad
npm test                     # Jest
npm run format               # Prettier
npx expo install --check     # versiones compatibles con el SDK
npx expo-doctor              # diagnóstico del proyecto
```

Dependencias nuevas siempre con `npx expo install <paquete>`.

## EAS (builds)

`eas.json` tiene los perfiles `development` (development build, APK interno), `preview` (APK interno) y `production`. Falta enlazar el proyecto: con la cuenta de Expo creada, `npx eas-cli@latest init` escribe el `projectId` en `app.json`. La development build hará falta para el mapa (MapLibre) y para las push remotas en Android, que Expo Go no soporta.
