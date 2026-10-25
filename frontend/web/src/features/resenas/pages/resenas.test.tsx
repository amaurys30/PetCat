import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ResenaPanel } from "@/api/resenas";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { paginaResenas, resenaDemo, resumenDemo } from "@/test/resenas";
import { API, fallo, http, HttpResponse, ok, servidor } from "@/test/servidor";

const laura = resenaDemo();
const sofia = resenaDemo({
  id_resena: 2,
  calificacion: 4,
  titulo: "Buena, pero hubo que esperar",
  autor: "Sofía G.",
  cliente: { id_usuario: 10, nombre: "Sofía", apellido: "García" },
  respuesta: {
    texto: "¡Gracias, Sofía! Ampliamos el horario.",
    fecha: "2026-09-20 10:00:00",
    editada: false,
  },
});
const julian = resenaDemo({
  id_resena: 3,
  calificacion: 1,
  titulo: "Pésimo",
  autor: "Julián M.",
  cliente: { id_usuario: 11, nombre: "Julián", apellido: "Mora" },
  reporte: { motivo: "lenguaje_ofensivo", detalle: null, fecha: "2026-09-21 09:00:00", reportada_por: null },
});

/** Responde la gestión y guarda los parámetros de cada consulta. */
function conResenas(data: ResenaPanel[] = [laura, sofia, julian], resumen = resumenDemo()) {
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get(`${API}/negocios/1/resenas/gestion`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      consultas.push(params);
      return HttpResponse.json(paginaResenas(data, resumen));
    }),
  );
  return consultas;
}

const tarjeta = (nombre: string) => screen.getByRole("article", { name: `Reseña de ${nombre}` });

const conPermisos = (resenas: string[]) =>
  usuarioDemo({
    negocios: [
      negocioDemo({
        relacion: "empleado",
        id_empleado: 4,
        rol: { id_rol: 3, nombre: "Recepcionista", permisos_json: { resenas } },
      }),
    ],
  });

beforeEach(() => __reiniciarSesionParaPruebas());

describe("E3 · Reseñas", () => {
  it("muestra el resumen, los filtros con conteos y cada reseña con su autor público y la visita", async () => {
    conResenas();
    renderRuta("/n/1/resenas", { usuario: usuarioDemo() });

    expect(await screen.findByText("4,7")).toBeInTheDocument();
    expect(screen.getByText("38 reseñas · 2 sin responder")).toBeInTheDocument();
    expect(screen.getByLabelText("28 de 5 estrellas")).toBeInTheDocument();
    const filtros = screen.getByRole("radiogroup", { name: "Filtrar reseñas" });
    expect(within(filtros).getByRole("radio", { name: /^Sin responders*2$/ })).toBeInTheDocument();
    expect(within(filtros).queryByRole("radio", { name: /Retiradas/ })).not.toBeInTheDocument();
    // El menú muestra las sin responder.
    expect(await screen.findByLabelText("2 sin responder")).toBeInTheDocument();

    const deLaura = tarjeta("Laura Gómez");
    expect(within(deLaura).getByText('se muestra como "Laura G."')).toBeInTheDocument();
    expect(
      within(deLaura).getByText("Visita verificada · agosto 2026 · Consulta general"),
    ).toBeInTheDocument();
    expect(within(deLaura).getByText("Atención 5")).toBeInTheDocument();
    expect(within(deLaura).queryByText(/Instalaciones/)).not.toBeInTheDocument();
    expect(
      within(deLaura).getByText(
        "Tu respuesta es pública y habla en nombre del negocio. No incluyas datos del cliente ni información médica de su mascota.",
      ),
    ).toBeInTheDocument();

    expect(
      within(tarjeta("Sofía García")).getByText(/Respuesta de Clínica Veterinaria Patitas · 20 sep 2026/),
    ).toBeInTheDocument();
    // La reportada sigue visible, con su marca.
    const deJulian = tarjeta("Julián Mora");
    expect(within(deJulian).getByText("Reportada · sigue visible hasta revisión")).toBeInTheDocument();
    expect(within(deJulian).getByText("Pésimo")).toBeInTheDocument();
    expect(screen.queryByText(/registrad/i)).not.toBeInTheDocument();
  });

  it("distingue la retirada por el cliente (sin acciones) de la oculta por PetCat", async () => {
    conResenas(
      [
        resenaDemo({ estado: "retirada", visible: false, retirada_en: "2026-10-02 18:40:00" }),
        resenaDemo({
          id_resena: 4,
          estado: "oculta",
          visible: false,
          cliente: { id_usuario: 12, nombre: "Pedro", apellido: "Díaz" },
        }),
      ],
      resumenDemo({ ocultas: 1, retiradas: 1 }),
    );
    renderRuta("/n/1/resenas", { usuario: usuarioDemo() });

    const retirada = await screen.findByRole("article", { name: "Reseña de Laura Gómez" });
    expect(within(retirada).getByText("Retirada por el cliente")).toBeInTheDocument();
    expect(within(retirada).queryByText("Oculta por PetCat")).not.toBeInTheDocument();
    expect(within(retirada).getByText(/retirada el 2 oct 2026/)).toBeInTheDocument();
    expect(within(retirada).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(retirada).queryByRole("button", { name: /Más acciones/ })).not.toBeInTheDocument();

    const oculta = tarjeta("Pedro Díaz");
    expect(within(oculta).getByText("Oculta por PetCat")).toBeInTheDocument();
    expect(within(oculta).queryByText("Retirada por el cliente")).not.toBeInTheDocument();

    const filtros = screen.getByRole("radiogroup", { name: "Filtrar reseñas" });
    expect(within(filtros).getByRole("radio", { name: /^Ocultas por PetCats*1$/ })).toBeInTheDocument();
    expect(within(filtros).getByRole("radio", { name: /^Retiradas por el clientes*1$/ })).toBeInTheDocument();
  });

  it("responde una reseña y edita y borra la respuesta", async () => {
    conResenas();
    const cuerpos: unknown[] = [];
    let borrada = false;
    servidor.use(
      http.put(`${API}/resenas/:id/respuesta`, async ({ request }) => {
        cuerpos.push(await request.json());
        return ok(sofia);
      }),
      http.delete(`${API}/resenas/2/respuesta`, () => {
        borrada = true;
        return ok({ ...sofia, respuesta: null });
      }),
    );
    renderRuta("/n/1/resenas", { usuario: usuarioDemo() });
    const user = userEvent.setup();

    const deLaura = await screen.findByRole("article", { name: "Reseña de Laura Gómez" });
    await user.click(within(deLaura).getByRole("button", { name: "Responder" }));
    expect(within(deLaura).getByText("Escribe la respuesta")).toBeInTheDocument();
    await user.type(within(deLaura).getByRole("textbox"), "¡Gracias por tu visita!");
    expect(within(deLaura).getByText("23 / 1000")).toBeInTheDocument();
    await user.click(within(deLaura).getByRole("button", { name: "Responder" }));
    expect(await screen.findByText("Respuesta publicada")).toBeInTheDocument();
    expect(cuerpos[0]).toEqual({ respuesta: "¡Gracias por tu visita!" });

    const deSofia = tarjeta("Sofía García");
    await user.click(within(deSofia).getByRole("button", { name: /Más acciones/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Editar respuesta" }));
    const campo = within(deSofia).getByRole("textbox");
    expect(campo).toHaveValue("¡Gracias, Sofía! Ampliamos el horario.");
    await user.clear(campo);
    await user.type(campo, "Gracias, Sofía.");
    await user.click(within(deSofia).getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Respuesta actualizada")).toBeInTheDocument();
    expect(cuerpos[1]).toEqual({ respuesta: "Gracias, Sofía." });

    await user.click(within(deSofia).getByRole("button", { name: /Más acciones/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Borrar respuesta" }));
    await user.click(await screen.findByRole("button", { name: "Borrar respuesta" }));
    expect(await screen.findByText("Respuesta borrada")).toBeInTheDocument();
    expect(borrada).toBe(true);
  });

  it("el aviso de la respuesta aparece aunque al recargar la tarjeta ya no muestre el formulario", async () => {
    let respondida = false;
    const conRespuesta = {
      ...laura,
      respuesta: { texto: "¡Gracias!", fecha: "2026-10-25 10:00:00", editada: false },
    };
    servidor.use(
      http.get(`${API}/negocios/1/resenas/gestion`, () =>
        HttpResponse.json(paginaResenas([respondida ? conRespuesta : laura])),
      ),
      http.put(`${API}/resenas/1/respuesta`, () => {
        respondida = true;
        return ok(conRespuesta);
      }),
    );
    renderRuta("/n/1/resenas", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const deLaura = await screen.findByRole("article", { name: "Reseña de Laura Gómez" });
    await user.type(within(deLaura).getByRole("textbox"), "¡Gracias!");
    await user.click(within(deLaura).getByRole("button", { name: "Responder" }));
    expect(await within(deLaura).findByText(/Respuesta de Clínica Veterinaria Patitas/)).toBeInTheDocument();
    expect(within(deLaura).queryByRole("textbox")).not.toBeInTheDocument();
    expect(await screen.findByText("Respuesta publicada")).toBeInTheDocument();
  });

  it("reporta con motivo; con 'Otro motivo' el detalle es obligatorio; una ya reportada no se reporta otra vez", async () => {
    conResenas();
    let cuerpo: unknown;
    servidor.use(
      http.post(`${API}/resenas/1/reportar`, async ({ request }) => {
        cuerpo = await request.json();
        return ok({
          ...laura,
          reporte: { motivo: "otro", detalle: "x", fecha: "2026-10-25 10:00:00", reportada_por: null },
        });
      }),
    );
    renderRuta("/n/1/resenas", { usuario: usuarioDemo() });
    const user = userEvent.setup();

    const deLaura = await screen.findByRole("article", { name: "Reseña de Laura Gómez" });
    await user.click(within(deLaura).getByRole("button", { name: /Más acciones/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Reportar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Reportar reseña" });
    expect(within(dialogo).getByText(/sigue publicada y cuenta en tu calificación/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("radio", { name: "Otro motivo" }));
    await user.click(within(dialogo).getByRole("button", { name: "Reportar" }));
    expect(await within(dialogo).findByText("Describe el motivo")).toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText("Detalle *"), "Habla de otro negocio");
    await user.click(within(dialogo).getByRole("button", { name: "Reportar" }));
    expect(await screen.findByText("Reseña reportada: PetCat la revisará")).toBeInTheDocument();
    expect(cuerpo).toEqual({ motivo: "otro", detalle: "Habla de otro negocio" });

    // La ya reportada (y sin respuesta) no tiene acciones: no se reporta otra vez.
    expect(
      within(tarjeta("Julián Mora")).queryByRole("button", { name: /Más acciones/ }),
    ).not.toBeInTheDocument();
  });

  it("el 409 al reportar se avisa y cierra el diálogo", async () => {
    conResenas();
    servidor.use(
      http.post(`${API}/resenas/1/reportar`, () =>
        fallo(409, "Esta reseña ya fue reportada: PetCat la revisará"),
      ),
    );
    renderRuta("/n/1/resenas", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    const deLaura = await screen.findByRole("article", { name: "Reseña de Laura Gómez" });
    await user.click(within(deLaura).getByRole("button", { name: /Más acciones/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Reportar" }));
    await user.click(await screen.findByRole("radio", { name: "Spam o publicidad" }));
    await user.click(screen.getByRole("button", { name: "Reportar" }));
    expect(await screen.findByText("Esta reseña ya fue reportada: PetCat la revisará")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("los filtros y el orden van en la URL y en la consulta; ?resena= muestra una sola", async () => {
    const consultas = conResenas();
    const { router } = renderRuta("/n/1/resenas", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await screen.findByText("4,7");

    await user.click(screen.getByRole("radio", { name: "1–2 ★" }));
    await waitFor(() => expect(consultas.at(-1)?.get("calificacion_max")).toBe("2"));
    expect(router.state.location.search).toBe("?filtro=bajas");

    await user.click(screen.getByRole("radio", { name: /^Sin responders*2$/ }));
    await waitFor(() => expect(consultas.at(-1)?.get("sin_responder")).toBe("true"));

    await user.click(screen.getByRole("combobox", { name: "Orden" }));
    await user.click(await screen.findByRole("option", { name: "Peor calificadas" }));
    await waitFor(() => expect(consultas.at(-1)?.get("orden")).toBe("peores"));
    expect(router.state.location.search).toBe("?filtro=sin_responder&orden=peores");

    await router.navigate("/n/1/resenas?resena=3");
    await waitFor(() => expect(consultas.at(-1)?.get("id_resena")).toBe("3"));
    expect(await screen.findByText("Mostrando una reseña.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todas las reseñas" }));
    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  it("sin resenas.responder ni resenas.reportar se ven las respuestas, sin campo ni menú", async () => {
    conResenas();
    renderRuta("/n/1/resenas", { usuario: conPermisos(["ver"]) });
    const deLaura = await screen.findByRole("article", { name: "Reseña de Laura Gómez" });
    expect(within(deLaura).queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Más acciones/ })).not.toBeInTheDocument();
    expect(
      within(tarjeta("Sofía García")).getByText("¡Gracias, Sofía! Ampliamos el horario."),
    ).toBeInTheDocument();
  });

  it("sin resenas.ver muestra el estado sin permiso", async () => {
    renderRuta("/n/1/resenas", { usuario: conPermisos([]) });
    expect(await screen.findByText(/No tienes permiso/)).toBeInTheDocument();
  });
});
