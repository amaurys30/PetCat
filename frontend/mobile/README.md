# PetCat · App móvil

App para dueños de mascotas (Expo SDK 58, React Native, TypeScript). Reglas en [CLAUDE.md](CLAUDE.md), fases en [PLAN.md](PLAN.md).

## Requisitos

- Node 24 y npm. Dependencias nuevas siempre con `npx expo install <paquete>`.
- La API de demo en Docker (`backend-demo`, puerto 3001, base `petcat_demo`).
- En el teléfono, **Expo Go** actualizado (tiene que soportar el SDK 58).

```powershell
cd frontend/mobile
npm install
```

## Probarla en el teléfono

La app usa `EXPO_PUBLIC_API_URL` (`.env`, ver `.env.example`). Si está vacía, en desarrollo toma la IP con la que Expo sirve el bundle (la que muestra la terminal) y el puerto 3001. El teléfono tiene que llegar a ese puerto: por wifi o por USB.

### Por wifi (opción B)

La API de demo escucha solo en `127.0.0.1`. Para abrirla a la red local:

1. En el `.env` de la **raíz** del repositorio, `DEMO_BIND=0.0.0.0`; luego recrear el contenedor:

   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile panel up -d --build backend-demo
   ```

2. Una regla de firewall **solo para redes privadas** (PowerShell como administrador, una vez):

   ```powershell
   New-NetFirewallRule -DisplayName "PetCat API demo (3001)" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
   ```

   La wifi tiene que estar como **Privada** en Windows (Configuración → Red e Internet → Wi-Fi → la red → Tipo de perfil de red). En una red pública la regla no aplica: usar el USB.

3. `npm start` y escanear el QR con Expo Go, con el teléfono en la misma wifi. Si Windows pregunta por Node.js, permitir solo en redes privadas (Metro, puerto 8081).

Si Expo muestra una IP que no es la de la wifi (por ejemplo `172.x.x.x`, de WSL o Docker), indicar la correcta (`ipconfig`):

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.50"; npm start
```

Para cerrarla: quitar `DEMO_BIND` del `.env` de la raíz, recrear el contenedor y `Remove-NetFirewallRule -DisplayName "PetCat API demo (3001)"`.

### Por USB, solo Android (opción A)

No abre nada a la red. Con la depuración USB activada y el teléfono conectado (`adb` viene en `%LOCALAPPDATA%\Android\Sdk\platform-tools`):

```powershell
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3001 tcp:3001
npm run start:usb
```

En la terminal de Expo, `a` abre la app en Expo Go. Al desconectar el cable se pierde la redirección: repetir los `adb reverse`.

### Qué revisar

- Abre en **Inicio**, con la barra de 5 pestañas y el botón **Carnet** elevado en coral. Tocar el círculo completo (también la parte que sobresale) cambia de pestaña.
- **Perfil → Ver la bienvenida** abre M1.
- **Perfil → Diagnóstico de la conexión** (solo en desarrollo) muestra la URL de la API y si responde `GET /health`. Si dice que no llega, abrir esa URL + `/health` en el navegador del teléfono.

## Comandos

```powershell
npm start; npm run start:usb   # servidor de Expo (wifi / USB)
npm run typecheck; npm run lint; npm test
npm run api:types              # regenera src/api/api-types.ts desde la API de demo (3001)
npm run e2e                    # Maestro, recorre las pestañas (ver e2e/navegacion.yaml)
npx expo install --check; npx expo-doctor
```

## EAS

`eas.json` tiene `development` (development build, APK interno), `preview` (APK interno) y `production`. Falta enlazar el proyecto: con la cuenta de Expo creada, `npx eas-cli@latest init` agrega el `projectId`. La development build hará falta para MapLibre (M4) y las push en Android (M6).
