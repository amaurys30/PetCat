import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Servicio } from "@/api/servicios";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { categoriasDemo, citaAfectadaDemo, servicioDemo } from "@/test/servicios";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const pagina = (data: Servicio[]) => ({
  success: true,
  message: "OK",
  data,
  meta: { total: data.length, page: 1, limit: 100, totalPages: 1, hasNext: false },
});

const consulta = servicioDemo();
const vacuna = servicioDemo({
  id_servicio: 2,
  nombre: "Vacuna antirrábica",
  categoria: { id_categoria: 2, nombre: "Vacunación" },
  precio_base: 35000,
  precio_actual: 28000,
  en_oferta: true,
  oferta_vigente: true,
  precio_oferta: 28000,
  fecha_inicio_oferta: "2026-01-01",
  fecha_fin_oferta: "2099-01-01",
});
const bano = servicioDemo({
  id_servicio: 3,
  nombre: "Baño y corte",
  categoria: { id_categoria: 3, nombre: "Baño y estética" },
  tipo_mascota: ["perro"],
  duracion_minutos: 60,
  margen_minutos: 15,
  empleados: [],
  sin_empleados: true,
  reservable: false,
});
const guarderia = servicioDemo({
  id_servicio: 4,
  nombre: "Guardería por día",
  tipo_precio: "por_dia",
  requiere_cita: false,
  empleados: [],
  sin_empleados: true,
  reservable: true,
  duracion_minutos: 1440,
});
const cirugia = servicioDemo({ id_servicio: 5, nombre: "Cirugía menor", visible_app: false });
const antiguo = servicioDemo({ id_servicio: 6, nombre: "Peluquería antigua", activo: false });

const base = (servicios = [consulta, vacuna, bano, guarderia, cirugia, antiguo]) => [
  http.get(`${API}/negocios/1/servicios`, () => HttpResponse.json(pagina(servicios))),
  http.get(`${API}/categorias-servicio`, () => ok(categoriasDemo)),
];

const tarjeta = (nombre: string) =>
  within(screen.getByRole("list", { name: "Servicios" }))
    .getAllByRole("listitem")
    .find((li) => within(li).queryByRole("link", { name: nombre }))!;

beforeEach(() => __reiniciarSesionParaPruebas());

describe("D1 · Catálogo de servicios", () => {
  it("muestra el resumen, las tarjetas con su estado y el aviso de servicios sin profesionales", async () => {
    servidor.use(...base());
    renderRuta("/n/1/servicios", { usuario: usuarioDemo() });

    expect(await screen.findByText("5 servicios activos · 3 reservables desde la app")).toBeInTheDocument();
    // Por defecto solo los activos.
    expect(screen.queryByRole("link", { name: "Peluquería antigua" })).not.toBeInTheDocument();

    const v = within(tarjeta("Vacuna antirrábica"));
    expect(v.getByText("En oferta")).toBeInTheDocument();
    expect(v.getByText(/28\.000/)).toBeInTheDocument();
    expect(v.getByText(/35\.000/)).toHaveClass("line-through");

    const b = within(tarjeta("Baño y corte"));
    expect(b.getByText("Solo perros")).toBeInTheDocument();
    expect(b.getByText("60 min + 15 de margen")).toBeInTheDocument();
    expect(b.getByText("Sin profesionales")).toBeInTheDocument();
    expect(b.getByText("No reservable")).toBeInTheDocument();

    const g = within(tarjeta("Guardería por día"));
    expect(g.getByText("Sin cita · por orden de llegada")).toBeInTheDocument();
    expect(g.getByText("No requiere cita")).toBeInTheDocument();
    expect(g.getByText("Reservable")).toBeInTheDocument();
    expect(g.getByText("Todo el día")).toBeInTheDocument();
    expect(g.getByText(/40\.000|45\.000/)).toHaveTextContent("/ día");

    expect(within(tarjeta("Cirugía menor")).getByText("Oculto en la app")).toBeInTheDocument();

    const aviso = screen.getByText(/«Baño y corte» no tiene profesionales asignados/);
    expect(aviso).toHaveTextContent("aparece en la app pero no se puede reservar");
    expect(screen.getByRole("link", { name: "Asignar →" })).toHaveAttribute(
      "href",
      "/n/1/servicios/3#profesionales",
    );
  });

  it("filtra por texto sin tildes, por categoría y por estado", async () => {
    servidor.use(...base());
    renderRuta("/n/1/servicios", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await screen.findByRole("link", { name: "Consulta general" });

    await user.type(screen.getByRole("searchbox", { name: "Buscar servicio" }), "bano");
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Servicios" })).getAllByRole("listitem")).toHaveLength(
        1,
      ),
    );
    expect(screen.getByRole("link", { name: "Baño y corte" })).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Buscar servicio" }));

    await user.click(screen.getByRole("combobox", { name: "Estado" }));
    await user.click(await screen.findByRole("option", { name: "Inactivos" }));
    expect(await screen.findByRole("link", { name: "Peluquería antigua" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Servicios" })).getAllByRole("listitem")).toHaveLength(1);

    await user.click(screen.getByRole("combobox", { name: "Estado" }));
    await user.click(await screen.findByRole("option", { name: "Todos" }));
    await user.click(screen.getByRole("combobox", { name: "Categoría" }));
    await user.click(await screen.findByRole("option", { name: "Vacunación" }));
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Servicios" })).getAllByRole("listitem")).toHaveLength(
        1,
      ),
    );
    expect(screen.getByRole("link", { name: "Vacuna antirrábica" })).toBeInTheDocument();
  });

  it("con varios servicios sin profesionales, el aviso los cuenta y filtra", async () => {
    const otro = servicioDemo({ ...bano, id_servicio: 7, nombre: "Corte de uñas" });
    servidor.use(...base([consulta, bano, otro]));
    renderRuta("/n/1/servicios", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Ver cuáles →" }));
    expect(
      screen.getByText("2 servicios no tienen profesionales asignados: no se pueden reservar."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Servicios" })).getAllByRole("listitem")).toHaveLength(
        2,
      ),
    );
    expect(screen.queryByRole("link", { name: "Consulta general" })).not.toBeInTheDocument();
  });

  it("vacío: invita a crear el primer servicio", async () => {
    servidor.use(...base([]));
    renderRuta("/n/1/servicios", { usuario: usuarioDemo() });
    expect(await screen.findByText("Crea tu primer servicio")).toBeInTheDocument();
  });

  it("desactivar con citas futuras: el 409 abre el diálogo con las citas", async () => {
    servidor.use(
      ...base(),
      http.delete(`${API}/servicios/1`, () =>
        HttpResponse.json(
          {
            success: false,
            message:
              "El servicio tiene 2 citas pendientes o confirmadas: cancélalas o reprográmalas antes de eliminarlo",
            data: {
              citas_afectadas: [citaAfectadaDemo(), citaAfectadaDemo({ id_cita: 31, fecha: "2026-10-13" })],
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderRuta("/n/1/servicios", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Acciones de Consulta general" }));
    await user.click(await screen.findByRole("menuitem", { name: "Desactivar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desactivar" }));

    const dialogo = await screen.findByRole("dialog", {
      name: "«Consulta general» no se puede desactivar: tiene 2 citas pendientes o confirmadas",
    });
    expect(within(dialogo).getAllByRole("row")).toHaveLength(3);
    expect(within(dialogo).getAllByText("Sofía Ruiz")).toHaveLength(2);
    expect(dialogo).toHaveTextContent("Cancela o reprograma estas citas y vuelve a intentarlo.");
  });

  it("desactivar sin citas lo deja inactivo y recarga el catálogo", async () => {
    let lista = [consulta, vacuna];
    servidor.use(
      http.get(`${API}/negocios/1/servicios`, () => HttpResponse.json(pagina(lista))),
      http.get(`${API}/categorias-servicio`, () => ok(categoriasDemo)),
      http.delete(`${API}/servicios/2`, () => {
        lista = [consulta, { ...vacuna, activo: false }];
        return ok(null);
      }),
    );
    renderRuta("/n/1/servicios", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Acciones de Vacuna antirrábica" }));
    await user.click(await screen.findByRole("menuitem", { name: "Desactivar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desactivar" }));
    expect(await screen.findByText(/«Vacuna antirrábica» quedó inactivo/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Vacuna antirrábica" })).not.toBeInTheDocument(),
    );
  });

  it("reactivar con el nombre ocupado ofrece cambiarle el nombre", async () => {
    servidor.use(
      ...base(),
      http.patch(`${API}/servicios/6/reactivar`, () =>
        fallo(409, "Ya existe un servicio activo con ese nombre en el negocio", { nombre: "Ya está en uso" }),
      ),
      http.get(`${API}/servicios/6/gestion`, () => ok(antiguo)),
      http.get(`${API}/negocios/1/empleados`, () => HttpResponse.json(pagina([]))),
    );
    const { router } = renderRuta("/n/1/servicios", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await screen.findByRole("link", { name: "Consulta general" });
    await user.click(screen.getByRole("combobox", { name: "Estado" }));
    await user.click(await screen.findByRole("option", { name: "Inactivos" }));
    await user.click(await screen.findByRole("button", { name: "Acciones de Peluquería antigua" }));
    await user.click(await screen.findByRole("menuitem", { name: "Reactivar" }));

    const dialogo = await screen.findByRole("dialog", {
      name: "Ya hay otro servicio activo llamado «Peluquería antigua»",
    });
    await user.click(within(dialogo).getByRole("button", { name: "Cambiar nombre" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/servicios/6"));
    expect(await screen.findByText(/Cámbiale el nombre, guarda y después reactívalo/)).toBeInTheDocument();
  });

  it("recepcionista (solo servicios.ver): sin crear ni acciones de cambio", async () => {
    servidor.use(...base());
    renderRuta("/n/1/servicios", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 3, nombre: "Recepcionista", permisos_json: { servicios: ["ver"] } },
          }),
        ],
      }),
    });
    const user = userEvent.setup();
    await screen.findByRole("link", { name: "Consulta general" });
    expect(screen.queryByRole("link", { name: /Nuevo servicio/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Asignar →" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Acciones de Consulta general" }));
    expect(await screen.findByRole("menuitem", { name: "Ver detalle" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Desactivar" })).not.toBeInTheDocument();
  });

  it("sin servicios.ver muestra el estado sin permiso", async () => {
    renderRuta("/n/1/servicios", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({ relacion: "empleado", rol: { id_rol: 2, nombre: "Veterinario", permisos_json: {} } }),
        ],
      }),
    });
    expect(await screen.findByText("No tienes permiso para ver esta sección")).toBeInTheDocument();
  });
});
