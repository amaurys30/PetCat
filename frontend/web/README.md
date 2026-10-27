# PetCat · Panel web

Panel para los **negocios** de PetCat (veterinarias, peluquerías, guarderías…): agenda, clientes, historial médico y vacunas, servicios, equipo y roles, configuración, reseñas, suscripción, dashboard, notificaciones y la administración de la plataforma. Los dueños de mascotas usan la app móvil (`frontend/mobile`, otro proyecto).

React 19 + Vite + TypeScript estricto, Tailwind con componentes shadcn/ui, TanStack Query, React Hook Form + Zod, Zustand y React Router. Las reglas completas están en [`CLAUDE.md`](CLAUDE.md) y el avance en [`PLAN.md`](PLAN.md); el estado general del proyecto, en [`docs/ESTADO.md`](../../docs/ESTADO.md).

---

## 1. Levantarlo

### Requisitos

- Node 24 y npm.
- Docker Desktop (la API y MySQL corren en contenedores).
- Google Chrome instalado (las pruebas de punta a punta lo usan; no descargan navegadores).

### La API de demo

El panel **siempre** trabaja contra la API de demo: el servicio `backend-demo` (127.0.0.1:3001, base `petcat_demo`, con el seed de demo). Nunca contra `petcat_backend` (3000, `petcat_db`), que es la base de desarrollo del backend.

Desde la raíz del repositorio (PowerShell; los comandos se separan con `;`):

```powershell
# Primera vez: copiar el .env de la raíz y el de backend (ver backend/README.md)
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile panel up -d --build

# Recargar petcat_demo con el esquema y el seed (las citas del seed son relativas a hoy)
docker compose exec backend-demo node scripts/db-demo.js

# Si llega una migración nueva (database/migrations), aplicarla a la demo
docker compose exec backend-demo npm run db:migrate
```

- Swagger de la demo: http://127.0.0.1:3001/api/v1/docs
- Correos de desarrollo (invitaciones, bienvenida, verificación): Mailpit en http://127.0.0.1:8025
- Con `docker-compose.dev.yml`, la API se reinicia sola al guardar un archivo de `backend/`.

### El panel

```powershell
cd frontend/web
npm install
Copy-Item .env.example .env.local   # opcional: todas las variables tienen valor por defecto
npm run dev                         # http://localhost:5173
```

Vite reenvía `/api` y `/socket.io` a `VITE_API_PROXY_TARGET` (por defecto `http://localhost:3001`), así que no hay CORS. Sin `VITE_GOOGLE_MAPS_API_KEY`, las sedes se ubican con latitud y longitud manuales.

### Cuentas del seed

Todas con la contraseña `Petcat123!` (la lista completa está en `backend/README.md`, "Usuarios de prueba" y "Seed de desarrollo"):

| Cuenta | Para probar |
|---|---|
| `propietario@petcat.test` | Propietaria de Clínica Veterinaria Patitas (plan Gratuito) |
| `saludanimal@petcat.test` | Propietario de Centro Veterinario Salud Animal 24h (Pro, Sede Norte de 24 horas): la usan las pruebas de agenda |
| `vet.salud@petcat.test` | Veterinaria en Salud Animal (sin `citas.ver_todas`: solo sus citas) y recepcionista en Huellitas: dos negocios |
| `admin@petcat.test` | Super admin: `/admin` |
| `camilo@petcat.test` | Dueño de mascotas con la app (Rocky y Mía) |

En desarrollo, `/dev/estados` muestra los estados del sistema, los de cita y los botones.

---

## 2. Probarlo

```powershell
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm test               # Vitest + Testing Library, con la API simulada (MSW)
npm run test:e2e       # Playwright contra la API de demo
npm run build          # build de producción en dist/
```

**Pruebas de componentes y pantallas** (`src/**/*.test.tsx`): pintan la app con las rutas reales (`renderRuta` de `src/test/render.tsx`) y una API simulada con MSW (`src/test/servidor.ts`). Cada prueba declara las respuestas que necesita con `servidor.use(http.get(...))`; una petición sin respuesta hace fallar la prueba. Los datos de ejemplo están en `src/test/<modulo>.ts` (`citaPanelDemo`, `registroDemo`…). No necesitan Docker.

**Pruebas de punta a punta** (`tests/e2e/*.spec.ts`): necesitan `backend-demo` y Mailpit encendidos. Construyen el panel en `dist-e2e` y lo sirven con `vite preview` en el puerto 5180 (no usan el Vite del 5173). Corren de a una (`workers: 1`) porque comparten la base de demo. Reglas:

- Cada prueba crea sus propios datos por la API (helpers de `tests/e2e/citas.ts`: `reservaPendiente`, `citaDeHoy`…) y los cancela o borra al final, en un `finally`. No dependen de las citas del seed, que vencen.
- La preparación llama directo a `http://127.0.0.1:3001`, no por el proxy de la vista previa.
- Los correos se leen de Mailpit (`tests/e2e/mailpit.ts`).
- `tests/e2e/accesibilidad.spec.ts` revisa con axe las pantallas principales.
- Si la demo quedó en un estado raro, recargarla con `db-demo.js`.

---

## 3. Estructura

```
frontend/web/
├── CLAUDE.md · PLAN.md · README.md · .env.example
├── docs/mockups/            # capturas de las 43 pantallas del Figma (fuente de diseño)
├── src/
│   ├── main.tsx · index.css # tokens de diseño en @theme (Tailwind 4)
│   ├── app/                 # router.tsx, guards, layouts (AuthLayout, PanelLayout, Sidebar, Topbar), menu.ts
│   ├── api/
│   │   ├── schema.d.ts      # GENERADO desde Swagger: npm run api:types (no se edita)
│   │   ├── types.ts         # tipos derivados (Body<>, DataGet<>, Usuario, Permisos…)
│   │   ├── client.ts        # Axios: token, renovación con una sola promesa, errores → ApiError
│   │   └── <modulo>.ts      # funciones por módulo: citas.ts, clientes.ts, salud.ts…
│   ├── features/<modulo>/   # una carpeta por sección del panel
│   │   ├── pages/           # pantallas (y sus pruebas *.test.tsx)
│   │   ├── components/      # piezas de la sección
│   │   ├── hooks/           # useXxx con TanStack Query (consultas y mutaciones)
│   │   ├── schemas.ts       # Zod de los formularios + conversión a la API
│   │   └── textos.ts        # textos y nombres para mostrar
│   ├── components/ui/       # shadcn adaptado a los tokens (button, dialog, select…)
│   ├── components/common/   # PageHeader, DataTable, EstadoCitaBadge, PlanLimitDialog, QueryState…
│   ├── lib/                 # format.ts (fechas, dinero), permisos.ts, queryKeys.ts, socket.ts…
│   ├── stores/              # Zustand: auth.ts (sesión), negocio.ts, ui.ts (diálogos globales)
│   └── test/                # renderRuta, servidor MSW y datos de ejemplo por módulo
└── tests/e2e/               # Playwright
```

Las pantallas pesadas (agenda, dashboard, ficha de la mascota, roles y administración) se cargan bajo demanda con `lazy` en `app/router.tsx`: no van en el archivo inicial.

---

## 4. Convenciones (lo mínimo; el detalle está en CLAUDE.md)

- **La API manda.** Si el diseño pide algo que la API no tiene, no se inventa: se anota en "Pendientes de API" de `PLAN.md`.
- **Tipos generados.** Después de cualquier cambio en la API: `npm run api:types` (lee `http://localhost:3001/api/v1/docs.json`). Nunca se escriben tipos de respuestas a mano.
- **Los componentes no llaman a Axios.** Funciones en `src/api/<modulo>.ts` → hooks en `features/<modulo>/hooks/` → componentes. Las claves de caché salen de `lib/queryKeys.ts`; una mutación invalida el prefijo que corresponda.
- **Avisos de éxito en el hook**, en el `onSuccess` del `useMutation`, nunca en `mutate(vars, { onSuccess })` del componente (TanStack descarta esos callbacks si el componente se desmonta).
- **Errores:** 422 → `errors` por campo en el formulario (`aplicarErroresApi`); 403 con `errors.plan` → `PlanLimitDialog`; 403 → "Sin permiso"; 404 → "No encontrado"; 409 → aviso con el `message` de la API. Los mensajes de la API se muestran tal cual.
- **Permisos:** `usePuede()(modulo, accion)` oculta o deshabilita lo que el rol no permite; la API decide igual, así que el 403 siempre se maneja. El propietario y el super admin pueden todo.
- **Negocio activo en la URL:** todo cuelga de `/n/:idNegocio/...`; `useNegocioActivo()` lo da.
- **Fechas y dinero:** la API envía `YYYY-MM-DD` y `HH:MM` en hora de Bogotá; nunca `new Date("YYYY-MM-DD")`. Usar `lib/format.ts` (`fechaCorta`, `hoyISO`, `dinero`…).
- **Estados de cada pantalla:** carga (esqueleto), vacío, error (`ErrorConsulta` con reintentar) y sin permiso (`SinPermiso`).
- **Accesibilidad:** cada campo con etiqueta (`Field`), diálogos con título, todo usable con teclado, foco visible. Las pruebas buscan por rol y nombre accesible (`getByRole("button", { name: "Guardar" })`): si una prueba no encuentra un control, probablemente le falta su nombre.
- **Estilo:** textos en español con tuteo; tokens de diseño (`text-ink`, `bg-primary`, `rounded-card`…), nunca colores sueltos; íconos de lucide-react.
- **Git:** una rama por fase (`panel-p7`…), un commit por tarea en español (`feat(panel/agenda): …`), PR a `main` al cerrar la fase.

---

## 5. Guía: agregar una pantalla nueva

Ejemplo: una sección **Inventario** con la lista de productos (`GET /negocios/:id_negocio/productos`, permiso `inventario.ver`).

1. **Confirmar el endpoint en Swagger** (http://127.0.0.1:3001/api/v1/docs): ruta, permiso, filtros y forma de la respuesta. Si no existe o le falta algo, anotarlo en "Pendientes de API" y avisar.

2. **Regenerar los tipos:** `npm run api:types`.

3. **Función de la API** en `src/api/inventario.ts`:

   ```ts
   import { apiGetPagina } from "./client";
   import type { components } from "./schema";

   export type Producto = components["schemas"]["Producto"];

   /** Requiere inventario.ver. */
   export const getProductos = (idNegocio: number, params: { page: number; limit: number; q?: string }) =>
     apiGetPagina<Producto>(`/negocios/${idNegocio}/productos`, params);
   ```

4. **Clave de caché** en `src/lib/queryKeys.ts`:

   ```ts
   inventario: {
     todo: (idNegocio: number) => ["inventario", idNegocio] as const,
     lista: (idNegocio: number, params: object) => ["inventario", idNegocio, "lista", params] as const,
   },
   ```

5. **Hook** en `src/features/inventario/hooks/useInventario.ts`:

   ```ts
   export function useProductos(idNegocio: number, params: { page: number; q?: string }, habilitada = true) {
     return useQuery({
       queryKey: queryKeys.inventario.lista(idNegocio, params),
       queryFn: () => api.getProductos(idNegocio, { ...params, limit: 20 }),
       enabled: habilitada,
       placeholderData: keepPreviousData,
     });
   }
   ```

   Una mutación (crear, editar) va en el mismo archivo, con el aviso de éxito en su `onSuccess` y la invalidación de `queryKeys.inventario.todo(idNegocio)`.

6. **La pantalla** en `src/features/inventario/pages/InventarioPage.tsx`, con sus cuatro estados:

   ```tsx
   export function InventarioPage() {
     const negocio = useNegocioActivo();
     const puede = usePuede();
     const productos = useProductos(negocio.id_negocio, { page: 1 }, puede("inventario", "ver"));

     if (!puede("inventario", "ver")) return <Card><SinPermiso /></Card>;
     if (productos.isPending) return <Skeleton className="h-96 rounded-card" />;
     if (productos.isError)
       return <Card><ErrorConsulta error={productos.error} reintentar={() => void productos.refetch()} /></Card>;
     if (productos.data.data.length === 0) return <Vacio icono={Package} titulo="Sin productos" />;
     return <PageHeader titulo="Inventario" />; /* … la tabla con DataTable … */
   }
   ```

7. **Ruta y menú.** En `src/app/menu.ts`, la sección (`ruta: "inventario"`, `permiso: ["inventario", "ver"]`) ya existe como pendiente: quitarla de la lista de "pendientes" en `app/router.tsx` y agregar la ruta bajo `n/:idNegocio`:

   ```tsx
   {
     path: "inventario",
     lazy: async () => ({ Component: (await import("@/features/inventario/pages/InventarioPage")).InventarioPage }),
     handle: { titulo: "Inventario" } satisfies HandleRuta,
   },
   ```

   Usa `lazy` si la pantalla es grande o trae una librería pesada; si no, un `element` normal.

8. **Formularios** (si hay): esquema Zod en `features/inventario/schemas.ts` con las mismas reglas que la API, `useForm` con `zodResolver`, campos con `Field`, y los 422 de la API con `aplicarErroresApi`.

9. **Prueba de la pantalla** en `src/features/inventario/pages/inventario.test.tsx`: datos de ejemplo en `src/test/inventario.ts`, `servidor.use(http.get(\`${API}/negocios/1/productos\`, ...))`, `renderRuta("/n/1/inventario", { usuario: usuarioDemo() })` y aserciones por rol y nombre. Incluir el caso sin permiso y el vacío.

10. **Prueba de punta a punta** en `tests/e2e/inventario.spec.ts` si la pantalla tiene un flujo importante: crear los datos por la API, recorrerlo en el navegador y limpiar en `finally`. Agregar la pantalla a `tests/e2e/accesibilidad.spec.ts`.

11. **Cerrar:** `npm run typecheck; npm run lint; npm test; npm run test:e2e`, revisarla en el navegador contra la demo y el mockup de `docs/mockups/`, marcarla en `PLAN.md` y anotar cualquier decisión de diseño en su sección "Decisiones".
