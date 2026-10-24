import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { Suscripcion } from "@/api/types";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";
import { planesDemo, suscripcionDemo, suscripcionEnPrueba } from "@/test/suscripcion";

const conSuscripcion = (datos: Suscripcion = suscripcionDemo()) =>
  servidor.use(
    http.get(`${API}/negocios/1/suscripcion`, () => ok(datos)),
    http.get(`${API}/planes`, () => ok(planesDemo)),
  );

const recepcionista = usuarioDemo({
  id_usuario: 7,
  negocios: [
    negocioDemo({
      relacion: "empleado",
      id_empleado: 4,
      rol: { id_rol: 3, nombre: "Recepcionista", permisos_json: { configuracion: ["ver"], citas: ["ver"] } },
    }),
  ],
});

beforeEach(() => __reiniciarSesionParaPruebas());

describe("E4 · Suscripción", () => {
  it("muestra el plan actual, el uso de cada límite, los planes y el contacto de soporte", async () => {
    conSuscripcion();
    renderRuta("/n/1/suscripcion", { usuario: usuarioDemo() });

    const actual = (await screen.findByRole("heading", { name: "Plan actual" })).parentElement!;
    expect(within(actual).getByText("Gratuito")).toBeInTheDocument();
    expect(within(actual).getByText("Activo")).toBeInTheDocument();
    expect(within(actual).getByText(/^Sin vencimiento/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Citas este mes" })).toHaveAttribute(
      "aria-valuenow",
      "26",
    );
    expect(screen.getByText("26 de 30")).toHaveClass("text-warning-ink");
    expect(screen.getByText("Empleados (sin contar al propietario)")).toBeInTheDocument();
    expect(screen.getByText("Productos (inventario, Fase 3)")).toBeInTheDocument();

    const planes = await screen.findByRole("region", { name: "Planes" });
    expect(within(planes).getByText("Recomendado")).toBeInTheDocument();
    expect(within(planes).getByRole("button", { name: "Plan actual" })).toBeDisabled();
    expect(within(planes).getByRole("button", { name: "Probar 14 días gratis" })).toBeInTheDocument();
    expect(within(planes).getByText("Estadísticas avanzadas y 12 meses de historia")).toBeInTheDocument();
    expect(within(planes).getByRole("link", { name: "Hablar con ventas" })).toHaveAttribute(
      "href",
      "mailto:soporte@petcat.com.co?subject=Plan%20Enterprise%20para%20Cl%C3%ADnica%20Veterinaria%20Patitas",
    );

    expect(screen.getByRole("link", { name: "soporte@petcat.com.co" })).toHaveAttribute(
      "href",
      "mailto:soporte@petcat.com.co",
    );
    expect(screen.getByRole("link", { name: "+57 300 123 4567" })).toHaveAttribute(
      "href",
      "https://wa.me/573001234567",
    );
  });

  it("el propietario activa la prueba Pro con una confirmación; el plan y el menú se actualizan", async () => {
    conSuscripcion();
    let activada = false;
    servidor.use(
      http.post(`${API}/negocios/1/suscripcion/prueba-pro`, () => {
        activada = true;
        return ok(suscripcionEnPrueba(), 201);
      }),
      http.get(`${API}/auth/me`, () =>
        ok(
          usuarioDemo({ negocios: [negocioDemo({ plan: { id_plan: 2, nombre: "Pro", en_prueba: true } })] }),
        ),
      ),
    );
    renderRuta("/n/1/suscripcion", { usuario: usuarioDemo() });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Probar Pro 14 días" }));
    const dialogo = await screen.findByRole("dialog", { name: "¿Activar la prueba del plan Pro?" });
    expect(within(dialogo).getByText(/se usa una sola vez/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Activar prueba" }));

    expect(await screen.findByText("Prueba del plan Pro activada: quedan 14 días")).toBeInTheDocument();
    expect(activada).toBe(true);
    const actual = screen.getByRole("heading", { name: "Plan actual" }).parentElement!;
    expect(within(actual).getByText("Pro")).toBeInTheDocument();
    expect(within(actual).getByText("En prueba · quedan 14 días")).toBeInTheDocument();
    expect(within(actual).getByText("Prueba gratis hasta el 6 nov 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Probar Pro 14 días" })).not.toBeInTheDocument();
    expect(screen.getByText("26 · ilimitado")).toBeInTheDocument();
    // El menú toma el plan de /auth/me.
    await waitFor(() => expect(screen.getByText("Plan Pro")).toBeInTheDocument());
  });

  it("si la API responde 409 al activar, lo avisa y recarga la suscripción", async () => {
    conSuscripcion();
    servidor.use(
      http.post(`${API}/negocios/1/suscripcion/prueba-pro`, () =>
        fallo(409, "El negocio ya usó su prueba gratuita del plan Pro"),
      ),
    );
    renderRuta("/n/1/suscripcion", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Probar Pro 14 días" }));
    await user.click(await screen.findByRole("button", { name: "Activar prueba" }));
    expect(await screen.findByText("El negocio ya usó su prueba gratuita del plan Pro")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("un empleado con configuracion.ver ve la suscripción, pero la prueba es solo del propietario", async () => {
    conSuscripcion();
    renderRuta("/n/1/suscripcion", { usuario: recepcionista });
    expect(await screen.findByText("Solo el propietario del negocio puede activarla.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Probar/ })).not.toBeInTheDocument();
    const planes = await screen.findByRole("region", { name: "Planes" });
    expect(within(planes).getByRole("link", { name: "Contratar" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:soporte@petcat\.com\.co\?subject=Plan%20Pro/),
    );
  });

  it("sin soporte configurado, el aviso es genérico y no hay enlace para contratar", async () => {
    conSuscripcion(suscripcionDemo({ soporte: { email: null, whatsapp: null }, prueba_disponible: false }));
    renderRuta("/n/1/suscripcion", { usuario: usuarioDemo() });
    expect(await screen.findByText(/Para contratar hoy, comunícate con PetCat\./)).toBeInTheDocument();
    const planes = await screen.findByRole("region", { name: "Planes" });
    expect(within(planes).getByRole("button", { name: "Contratar" })).toBeDisabled();
    expect(within(planes).getByRole("button", { name: "Hablar con ventas" })).toBeDisabled();
  });

  it("una prueba que terminó avisa que el negocio volvió al Gratuito", async () => {
    const vencida = suscripcionEnPrueba();
    conSuscripcion({
      ...suscripcionDemo({ prueba_disponible: false }),
      suscripcion: { ...vencida.suscripcion!, estado: "vencida", dias_prueba_restantes: null },
    });
    renderRuta("/n/1/suscripcion", { usuario: usuarioDemo() });
    expect(await screen.findByText("Pro vencido")).toBeInTheDocument();
    expect(
      screen.getByText(/^Tu prueba del plan Pro terminó el 6 nov 2026\. Volviste al plan Gratuito/),
    ).toBeInTheDocument();
  });

  it("sin configuracion.ver muestra el estado sin permiso", async () => {
    const sinPermiso = usuarioDemo({
      negocios: [
        negocioDemo({
          relacion: "empleado",
          id_empleado: 4,
          rol: { id_rol: 4, nombre: "Veterinario", permisos_json: { citas: ["ver"] } },
        }),
      ],
    });
    renderRuta("/n/1/suscripcion", { usuario: sinPermiso });
    expect(await screen.findByText(/No tienes permiso/)).toBeInTheDocument();
  });
});

describe("Invitación a Pro (diálogo del límite del plan)", () => {
  it("activa la prueba desde el diálogo sin ir a Suscripción", async () => {
    conSuscripcion();
    servidor.use(
      http.post(`${API}/negocios/1/suscripcion/prueba-pro`, () => ok(suscripcionEnPrueba(), 201)),
      http.get(`${API}/auth/me`, () => ok(usuarioDemo())),
    );
    const { router } = renderRuta("/n/1/mi-perfil", { usuario: usuarioDemo() });
    const { useUi } = await import("@/stores/ui");
    useUi
      .getState()
      .abrirLimitePlan("Tu plan Gratuito permite 3 empleados activos. Mejora tu plan para continuar.");
    const user = userEvent.setup();
    const dialogo = await screen.findByRole("dialog", { name: "Alcanzaste el límite de tu plan" });
    await user.click(await within(dialogo).findByRole("button", { name: "Probar Pro 14 días" }));
    await user.click(await screen.findByRole("button", { name: "Activar prueba" }));
    expect(await screen.findByText("Prueba del plan Pro activada: quedan 14 días")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe("/n/1/mi-perfil");
  });
});
