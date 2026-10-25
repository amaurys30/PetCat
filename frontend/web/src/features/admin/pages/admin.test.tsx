import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addMonths, addYears, format } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";
import type { NegocioAdmin, SuscripcionHistorial } from "@/api/admin";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { destinoInicial } from "@/app/destino";
import { hoyISO, parseFecha } from "@/lib/format";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";
import { planesDemo, suscripcionDemo } from "@/test/suscripcion";

const admin = usuarioDemo({
  id_usuario: 1,
  nombre: "Admin",
  apellido: "PetCat",
  tipo_usuario: "admin",
  negocios: [],
});

const guarderia: NegocioAdmin = {
  id_negocio: 3,
  nombre: "Guardería Patas Felices",
  tipo: "guarderia",
  ciudad: "Sincelejo",
  activo: true,
  fecha_registro: "2026-09-01 10:00:00",
  propietario: { id_usuario: 6, nombre: "Rosa", apellido: "Díaz", email: "guarderia@petcat.test" },
  plan: { id_plan: 1, nombre: "Gratuito" },
  estado: "activa",
  suscripcion: {
    id_suscripcion: 5,
    plan: { id_plan: 1, nombre: "Gratuito" },
    estado: "activa",
    tipo_facturacion: "mensual",
    fecha_inicio: "2026-09-01",
    fecha_fin: "9999-12-31",
    fecha_prueba_fin: null,
  },
  citas_mes: { mes: "2026-10", usadas: 26, maximo: 30 },
};
const salud: NegocioAdmin = {
  ...guarderia,
  id_negocio: 4,
  nombre: "Salud Animal 24h",
  tipo: "clinica",
  plan: { id_plan: 2, nombre: "Pro" },
  estado: "en_prueba",
  suscripcion: {
    ...guarderia.suscripcion!,
    id_suscripcion: 9,
    plan: { id_plan: 2, nombre: "Pro" },
    estado: "en_prueba",
    fecha_fin: "2026-11-04",
    fecha_prueba_fin: "2026-11-04",
  },
  citas_mes: { mes: "2026-10", usadas: 114, maximo: -1 },
};

const historial: SuscripcionHistorial[] = [
  {
    id_suscripcion: 6,
    plan: { id_plan: 2, nombre: "Pro" },
    estado: "cancelada",
    tipo_facturacion: "mensual",
    fecha_inicio: "2026-09-10",
    fecha_fin: "2026-10-10",
    fecha_prueba_fin: null,
    monto_pagado: 120000,
    notas: "Transferencia ref. 88213",
    fecha_creacion: "2026-09-10 11:00:00",
    registrada_por: {
      id_usuario: 1,
      nombre: "Ana",
      apellido: "Admin",
      email: "admin@petcat.test",
      es_admin: true,
    },
  },
  {
    id_suscripcion: 5,
    plan: { id_plan: 1, nombre: "Gratuito" },
    estado: "cancelada",
    tipo_facturacion: "mensual",
    fecha_inicio: "2026-09-01",
    fecha_fin: "9999-12-31",
    fecha_prueba_fin: null,
    monto_pagado: 0,
    notas: null,
    fecha_creacion: "2026-09-01 10:00:00",
    registrada_por: null,
  },
];

function conAdmin() {
  const registro = { consultas: [] as URLSearchParams[], cuerpos: [] as unknown[] };
  servidor.use(
    http.get(`${API}/admin/negocios`, ({ request }) => {
      registro.consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        success: true,
        message: "OK",
        data: [guarderia, salud],
        meta: { total: 2, page: 1, limit: 20, totalPages: 1, hasNext: false },
      });
    }),
    http.get(`${API}/admin/negocios/3/suscripciones`, () => ok(historial)),
    http.get(`${API}/planes`, () => ok(planesDemo)),
    http.put(`${API}/negocios/3/suscripcion`, async ({ request }) => {
      const cuerpo = (await request.json()) as { notas?: string };
      registro.cuerpos.push(cuerpo);
      if (cuerpo.notas === "error")
        return fallo(422, "Datos inválidos", { fecha_fin: "Debe ser una fecha futura" });
      return ok(suscripcionDemo({ plan: planesDemo[1]! }));
    }),
  );
  return registro;
}

const enUnMes = () => format(addMonths(parseFecha(hoyISO()), 1), "yyyy-MM-dd");
const enUnAno = () => format(addYears(parseFecha(hoyISO()), 1), "yyyy-MM-dd");

beforeEach(() => __reiniciarSesionParaPruebas());

describe("Acceso a la administración", () => {
  it("el admin sin negocios entra a /admin; con negocios, al panel o al selector; los demás, nunca", () => {
    expect(destinoInicial(admin)).toBe("/admin");
    expect(destinoInicial({ ...admin, negocios: [negocioDemo()] })).toBe("/n/1");
    expect(destinoInicial(admin, "/admin?negocio=3")).toBe("/admin?negocio=3");
    expect(destinoInicial(usuarioDemo(), "/admin")).toBe("/n/1");
  });

  it("un usuario que no es admin ve No encontrado en /admin", async () => {
    renderRuta("/admin", { usuario: usuarioDemo() });
    expect((await screen.findAllByText(/no existe|No encontr/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Administración PetCat" })).not.toBeInTheDocument();
  });

  it("A5 ofrece la administración al admin que también tiene negocios", async () => {
    renderRuta("/negocios", { usuario: { ...admin, negocios: [negocioDemo()] } });
    expect(await screen.findByRole("link", { name: /Administración PetCat/ })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});

describe("X1 · Negocios y planes", () => {
  it("lista los negocios con plan, estado, vencimiento y citas del mes; filtra con la URL", async () => {
    const registro = conAdmin();
    const { router } = renderRuta("/admin", { usuario: admin });
    const user = userEvent.setup();
    const tabla = await screen.findByRole("table", { name: "Negocios de PetCat" });
    const filaSalud = within(tabla).getByRole("row", { name: /Salud Animal 24h/ });
    expect(within(filaSalud).getByText("En prueba")).toBeInTheDocument();
    expect(within(filaSalud).getByText("4 nov 2026")).toBeInTheDocument();
    expect(within(filaSalud).getByText("114")).toBeInTheDocument();
    expect(
      within(within(tabla).getByRole("row", { name: /Guardería/ })).getByText("26 / 30"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Buscar negocio"), "guar");
    await waitFor(() => expect(registro.consultas.at(-1)?.get("q")).toBe("guar"));
    await user.click(screen.getByRole("combobox", { name: "Estado" }));
    await user.click(await screen.findByRole("option", { name: "Vencida" }));
    await waitFor(() => expect(registro.consultas.at(-1)?.get("estado")).toBe("vencida"));
    expect(router.state.location.search).toBe("?q=guar&estado=vencida");
  });

  it("elegir un negocio mientras corre la espera de la búsqueda no se pierde al buscar", async () => {
    const registro = conAdmin();
    const { router } = renderRuta("/admin", { usuario: admin });
    const user = userEvent.setup();
    await screen.findByRole("table", { name: "Negocios de PetCat" });
    await user.type(screen.getByLabelText("Buscar negocio"), "guar");
    await user.click(screen.getByRole("button", { name: "Guardería Patas Felices" }));
    await waitFor(() => expect(registro.consultas.at(-1)?.get("q")).toBe("guar"));
    expect(new URLSearchParams(router.state.location.search).get("negocio")).toBe("3");
    expect(
      screen.getByRole("heading", { name: "Asignar plan · Guardería Patas Felices" }),
    ).toBeInTheDocument();
  });

  it("asigna un plan: propone la fecha y el monto según el plan y la facturación, y muestra quién asignó cada uno", async () => {
    const registro = conAdmin();
    renderRuta("/admin?negocio=3", { usuario: admin });
    const user = userEvent.setup();

    expect(
      await screen.findByRole("heading", { name: "Asignar plan · Guardería Patas Felices" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Pro" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Fecha de fin")).toHaveValue(enUnMes());
    expect(screen.getByLabelText("Monto pagado (COP)")).toHaveValue("120.000");
    await user.click(screen.getByRole("radio", { name: "Anual" }));
    expect(screen.getByLabelText("Fecha de fin")).toHaveValue(enUnAno());
    expect(screen.getByLabelText("Monto pagado (COP)")).toHaveValue("1.080.000");

    await user.type(screen.getByLabelText("Notas"), "Pago por transferencia");
    await user.click(screen.getByRole("button", { name: "Asignar plan" }));
    expect(await screen.findByText("Plan Pro asignado a Guardería Patas Felices")).toBeInTheDocument();
    expect(registro.cuerpos[0]).toEqual({
      id_plan: 2,
      tipo_facturacion: "anual",
      fecha_fin: enUnAno(),
      monto_pagado: 1080000,
      notas: "Pago por transferencia",
    });

    const lista = screen.getByRole("list", { name: "Historial de Guardería Patas Felices" });
    expect(within(lista).getByText("Ana Admin · super admin · 10 sep 2026, 11:00")).toBeInTheDocument();
    expect(within(lista).getByText(/^Automática/)).toBeInTheDocument();
    expect(within(lista).getByText("Transferencia ref. 88213")).toBeInTheDocument();
  });

  it("el Gratuito no lleva fecha de fin; los 422 quedan en su campo", async () => {
    const registro = conAdmin();
    renderRuta("/admin?negocio=3", { usuario: admin });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Gratuito" }));
    expect(screen.getByLabelText("Fecha de fin")).toHaveValue("Sin vencimiento");
    await user.click(screen.getByRole("button", { name: "Asignar plan" }));
    await waitFor(() => expect(registro.cuerpos).toHaveLength(1));
    expect(registro.cuerpos[0]).toEqual({ id_plan: 1, tipo_facturacion: "mensual", monto_pagado: 0 });

    await user.click(screen.getByRole("radio", { name: "Pro" }));
    await user.type(screen.getByLabelText("Notas"), "error");
    await user.click(screen.getByRole("button", { name: "Asignar plan" }));
    expect(await screen.findByText("Debe ser una fecha futura")).toBeInTheDocument();
  });
});
