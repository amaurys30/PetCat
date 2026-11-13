import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Empleado } from "@/api/empleados";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { hoyISO } from "@/lib/format";
import { empleadoDemo, rolesDemo } from "@/test/equipo";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { categoriasDemo, servicioDemo } from "@/test/servicios";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const paginaEmpleados = (data: Empleado[]) => ({
  success: true,
  message: "OK",
  data,
  meta: { total: data.length, page: 1, limit: 100, totalPages: 1, hasNext: false },
});

const carlos = empleadoDemo({ especialidad: "Medicina general" });
const paula = empleadoDemo({
  id_empleado: 2,
  nombre: "Paula",
  apellido: "Rojas",
  rol: { id_rol: 3, nombre: "Recepcionista" },
});

const base = () => [
  http.get(`${API}/categorias-servicio`, () => ok(categoriasDemo)),
  // Paula (recepción) primero en la lista de la API: en D2 va después de los roles clínicos.
  http.get(`${API}/negocios/1/empleados`, () => HttpResponse.json(paginaEmpleados([paula, carlos]))),
  http.get(`${API}/negocios/1/roles`, () => ok(rolesDemo)),
  http.get(`${API}/negocios/1/servicios`, () => HttpResponse.json({ ...paginaEmpleados([]), data: [] })),
];

describe("D2 · Profesionales que lo atienden", () => {
  beforeEach(() => __reiniciarSesionParaPruebas());

  it("muestra primero los roles clínicos (los que pueden crear registros médicos)", async () => {
    servidor.use(...base());
    renderRuta("/n/1/servicios/nuevo", { usuario: usuarioDemo() });
    const clinica = await screen.findByRole("list", { name: "Atención clínica" });
    expect(within(clinica).getByRole("checkbox", { name: /^Carlos/ })).toBeInTheDocument();
    const otros = screen.getByRole("list", { name: "Otros roles" });
    expect(within(otros).getByRole("checkbox", { name: /^Paula Rojas/ })).toBeInTheDocument();
    expect(clinica.compareDocumentPosition(otros) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

const escribir = (etiqueta: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

async function elegirCategoria(user: ReturnType<typeof userEvent.setup>, nombre: string) {
  await user.click(screen.getByRole("combobox", { name: "Categoría *" }));
  await user.click(await screen.findByRole("option", { name: nombre }));
}

beforeEach(() => __reiniciarSesionParaPruebas());

describe("D2 · Nuevo servicio", () => {
  it("valida las reglas de la API y crea el servicio con su oferta, días, profesionales e indicaciones", async () => {
    let creado: unknown;
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/servicios`, async ({ request }) => {
        creado = await request.json();
        return ok(servicioDemo({ id_servicio: 9, nombre: "Vacuna triple" }), 201);
      }),
    );
    const { router } = renderRuta("/n/1/servicios/nuevo", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await screen.findByLabelText("Nombre *");

    await user.type(screen.getByLabelText("Nombre *"), "Vacuna triple");
    await elegirCategoria(user, "Vacunación");

    // "Todas" no se combina con otras especies.
    const especies = screen.getByRole("group", { name: "Especies que atiende *" });
    expect(within(especies).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(especies).getByRole("button", { name: "Perro" }));
    await user.click(within(especies).getByRole("button", { name: "Gato" }));
    expect(within(especies).getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "false");

    escribir("Precio base (COP) *", "45000");
    expect(screen.getByLabelText("Precio base (COP) *")).toHaveValue("45.000");
    escribir("Precio máximo", "40000");
    escribir("Duración (min) *", "32");
    escribir("Margen después (min)", "7");
    escribir("Máx. citas por día", "300");

    await user.click(screen.getByRole("switch", { name: "En oferta" }));
    // La fecha de inicio se propone con hoy.
    expect(screen.getByLabelText("Desde *")).toHaveValue(hoyISO());
    escribir("Precio de oferta *", "45000");
    await user.click(screen.getByRole("button", { name: "Guardar servicio" }));

    expect(await screen.findByText("Debe ser mayor o igual que el precio base")).toBeInTheDocument();
    expect(screen.getAllByText("Debe ser múltiplo de 5")).toHaveLength(2);
    expect(screen.getByText("Debe estar entre 1 y 255")).toBeInTheDocument();
    expect(screen.getByText("Debe ser menor que el precio base")).toBeInTheDocument();
    expect(screen.getByText("Obligatoria si el servicio está en oferta")).toBeInTheDocument();
    expect(creado).toBeUndefined();

    escribir("Precio máximo", "");
    escribir("Duración (min) *", "45");
    escribir("Margen después (min)", "15");
    escribir("Máx. citas por día", "8");
    escribir("Precio de oferta *", "38000");
    escribir("Desde *", "2020-01-01");
    escribir("Hasta *", "2020-01-05");
    await user.click(screen.getByRole("button", { name: "Guardar servicio" }));
    expect(await screen.findByText("No puede ser anterior a hoy")).toBeInTheDocument();
    escribir("Hasta *", "2099-01-10");

    // Sin domingo.
    await user.click(screen.getByRole("button", { name: "domingo" }));
    await user.click(screen.getByRole("checkbox", { name: /Carlos Martínez/ }));
    await user.type(screen.getByLabelText("Indicaciones previas"), "Ayuno de 8 horas{Enter}Trae el carnet");
    await user.click(screen.getByRole("button", { name: "Guardar servicio" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/servicios"));
    expect(creado).toEqual({
      id_categoria: 2,
      nombre: "Vacuna triple",
      descripcion: null,
      indicaciones_previas: "Ayuno de 8 horasTrae el carnet",
      precio_base: 45000,
      precio_maximo: null,
      tipo_precio: "fijo",
      duracion_minutos: 45,
      margen_minutos: 15,
      tipo_mascota: ["perro", "gato"],
      peso_min_kg: null,
      peso_max_kg: null,
      requiere_cita: true,
      max_citas_dia: 8,
      dias_disponible: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
      visible_app: true,
      en_oferta: true,
      precio_oferta: 38000,
      fecha_inicio_oferta: "2020-01-01",
      fecha_fin_oferta: "2099-01-10",
      empleados: [1],
    });
    // Llena todo el formulario: con la suite completa en paralelo pasa de los 15 s globales.
  }, 40_000);

  it("sin profesionales pide confirmación; sin días y sin especies no deja guardar", async () => {
    let creado: unknown;
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/servicios`, async ({ request }) => {
        creado = await request.json();
        return ok(servicioDemo({ id_servicio: 9 }), 201);
      }),
    );
    renderRuta("/n/1/servicios/nuevo", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nombre *"), "Baño");
    await elegirCategoria(user, "Baño y estética");
    escribir("Precio base (COP) *", "30000");
    await user.click(screen.getByRole("button", { name: "Todas" }));
    for (const dia of ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]) {
      await user.click(screen.getByRole("button", { name: dia }));
    }
    await user.click(screen.getByRole("button", { name: "Guardar servicio" }));
    expect(await screen.findByText("Elige al menos un día")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "lunes" }));
    await user.click(screen.getByRole("button", { name: "Guardar servicio" }));
    const dialogo = await screen.findByRole("dialog", { name: "¿Guardar sin profesionales?" });
    expect(dialogo).toHaveTextContent("Aparecerá en la app, pero nadie podrá reservarlo");
    await user.click(within(dialogo).getByRole("button", { name: "Guardar igual" }));
    await waitFor(() => expect(creado).toMatchObject({ empleados: [], dias_disponible: ["lunes"] }));
  });

  it("el 409 por nombre repetido marca el campo", async () => {
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/servicios`, () =>
        fallo(409, "Ya existe un servicio activo con ese nombre en el negocio", { nombre: "Ya está en uso" }),
      ),
    );
    renderRuta("/n/1/servicios/nuevo", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nombre *"), "Consulta general");
    await elegirCategoria(user, "Consulta y diagnóstico");
    escribir("Precio base (COP) *", "30000");
    await user.click(screen.getByRole("checkbox", { name: /Carlos Martínez/ }));
    await user.click(screen.getByRole("button", { name: "Guardar servicio" }));
    expect(await screen.findByText("Ya hay otro servicio activo con este nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre *")).toHaveAttribute("aria-invalid", "true");
  });

  it("la vista previa reproduce el recordatorio con las indicaciones", async () => {
    servidor.use(...base());
    renderRuta("/n/1/servicios/nuevo", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nombre *"), "Cirugía menor");
    fireEvent.change(screen.getByLabelText("Indicaciones previas"), {
      target: { value: "Ayuno de 8 horas.\nTrae el carnet" },
    });
    expect(screen.getByLabelText("Indicaciones previas")).toHaveValue("Ayuno de 8 horas. Trae el carnet");
    expect(screen.getByText("32 / 500")).toBeInTheDocument();
    expect(screen.getByTestId("vista-previa-indicaciones")).toHaveTextContent(
      /^Mañana, .+ a las 9:00 a\. m\., Max tiene Cirugía menor en Clínica Veterinaria Patitas\. Indicaciones del negocio: Ayuno de 8 horas\. Trae el carnet\. Si no puedes asistir/,
    );
  });
});

describe("D2 · Editar servicio", () => {
  const vencida = servicioDemo({
    en_oferta: true,
    precio_oferta: 38000,
    fecha_inicio_oferta: "2020-01-01",
    fecha_fin_oferta: "2020-02-01",
    oferta_vigente: false,
  });

  it("con la oferta vencida sin tocar guarda lo demás y envía solo lo que cambió", async () => {
    let cambios: unknown;
    servidor.use(
      ...base(),
      http.get(`${API}/servicios/1/gestion`, () => ok(vencida)),
      http.patch(`${API}/servicios/1`, async ({ request }) => {
        cambios = await request.json();
        return ok(vencida);
      }),
    );
    const { router } = renderRuta("/n/1/servicios/1", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    expect(await screen.findByText(/La oferta venció el 1 feb 2020/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Descripción"));
    await user.type(screen.getByLabelText("Descripción"), "Nueva descripción");
    await user.click(screen.getByRole("checkbox", { name: /Paula Rojas/ }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/n/1/servicios"));
    expect(cambios).toEqual({ descripcion: "Nueva descripción", empleados: [1, 2] });
  });

  it("al cambiar una oferta vencida se exige un fin desde hoy; «Quitar oferta» la apaga", async () => {
    let cambios: unknown;
    servidor.use(
      ...base(),
      http.get(`${API}/servicios/1/gestion`, () => ok(vencida)),
      http.patch(`${API}/servicios/1`, async ({ request }) => {
        cambios = await request.json();
        return ok(servicioDemo());
      }),
    );
    renderRuta("/n/1/servicios/1", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await screen.findByText(/La oferta venció/);
    escribir("Precio de oferta *", "35000");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("No puede ser anterior a hoy")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar oferta" }));
    expect(screen.queryByLabelText("Precio de oferta *")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(cambios).toEqual({
        en_oferta: false,
        precio_oferta: null,
        fecha_inicio_oferta: null,
        fecha_fin_oferta: null,
      }),
    );
  });

  it("llega a la sección de profesionales con #profesionales", async () => {
    servidor.use(
      ...base(),
      http.get(`${API}/servicios/1/gestion`, () => ok(servicioDemo({ empleados: [] }))),
    );
    renderRuta("/n/1/servicios/1#profesionales", { usuario: usuarioDemo() });
    await screen.findByRole("checkbox", { name: /Carlos Martínez/ });
    await waitFor(() => expect(document.activeElement?.id).toBe("profesionales"));
  });

  it("sin empleados.ver los profesionales se ven y no se envían", async () => {
    let cambios: unknown;
    servidor.use(
      ...base(),
      http.get(`${API}/servicios/1/gestion`, () => ok(servicioDemo())),
      http.patch(`${API}/servicios/1`, async ({ request }) => {
        cambios = await request.json();
        return ok(servicioDemo());
      }),
    );
    renderRuta("/n/1/servicios/1", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 9, nombre: "Coordinador", permisos_json: { servicios: ["ver", "editar"] } },
          }),
        ],
      }),
    });
    const user = userEvent.setup();
    expect(
      await screen.findByText("Para cambiar los profesionales necesitas el permiso de ver el equipo."),
    ).toBeInTheDocument();
    expect(screen.getByText("Carlos Martínez")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    escribir("Duración (min) *", "40");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(cambios).toEqual({ duracion_minutos: 40 }));
  });

  it("solo con servicios.ver el formulario es de lectura", async () => {
    servidor.use(
      ...base(),
      http.get(`${API}/servicios/1/gestion`, () => ok(servicioDemo())),
    );
    renderRuta("/n/1/servicios/1", {
      usuario: usuarioDemo({
        negocios: [
          negocioDemo({
            relacion: "empleado",
            rol: { id_rol: 3, nombre: "Recepcionista", permisos_json: { servicios: ["ver"] } },
          }),
        ],
      }),
    });
    expect(await screen.findByText(/Solo puedes ver este servicio/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre *")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
  });

  it("servicio inexistente: estado no encontrado", async () => {
    servidor.use(
      ...base(),
      http.get(`${API}/servicios/99/gestion`, () => fallo(404, "Servicio no encontrado")),
    );
    renderRuta("/n/1/servicios/99", { usuario: usuarioDemo() });
    expect(await screen.findByText("Servicio no encontrado")).toBeInTheDocument();
  });
});
