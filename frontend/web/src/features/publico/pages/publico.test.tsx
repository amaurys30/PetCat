import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiPublica, negocioBusquedaDemo, resenaLandingDemo } from "@/test/publico";
import { renderRuta, usuarioDemo } from "@/test/render";

/** Simula la geolocalización del navegador: éxito con esas coordenadas, o error (permiso denegado). */
function geolocalizacion(resultado: { lat: number; lng: number } | "denegada") {
  const getCurrentPosition = vi.fn((exito: PositionCallback, error?: PositionErrorCallback | null) => {
    if (resultado === "denegada") error?.({ code: 1, message: "denegada" } as GeolocationPositionError);
    else exito({ coords: { latitude: resultado.lat, longitude: resultado.lng } } as GeolocationPosition);
  });
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("landing (/)", () => {
  it("sin sesión ofrece iniciar sesión; con sesión, ir al panel, y la página se sigue mostrando", async () => {
    apiPublica();
    const { unmount } = renderRuta("/");
    expect(screen.getByRole("heading", { level: 1, name: /Todo lo de tu mascota/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Iniciar sesión" })[0]).toHaveAttribute("href", "/login");
    expect(screen.getAllByRole("link", { name: "¿Tienes una veterinaria?" })[0]).toHaveAttribute(
      "href",
      "/para-negocios",
    );
    unmount();

    renderRuta("/", { usuario: usuarioDemo() });
    expect(screen.getByRole("heading", { level: 1, name: /Todo lo de tu mascota/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Ir al panel" })[0]).toHaveAttribute("href", "/panel");
    expect(screen.queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
  });

  it("la app aparece como próximamente, sin enlaces a las tiendas", () => {
    apiPublica();
    renderRuta("/");
    const tiendas = screen.getByRole("list", { name: "Descargar la app" });
    expect(within(tiendas).getByText("Google Play")).toBeInTheDocument();
    expect(within(tiendas).getByText("App Store")).toBeInTheDocument();
    expect(within(tiendas).getAllByText("Próximamente en")).toHaveLength(2);
    expect(within(tiendas).queryByRole("link")).toBeNull();
  });

  describe("buscador", () => {
    it("busca cerca de Sincelejo y muestra las tarjetas con calificación, distancia y confirmación inmediata", async () => {
      const { busquedas } = apiPublica({
        negocios: [
          negocioBusquedaDemo(),
          negocioBusquedaDemo({
            id_negocio: 2,
            nombre: "Peluquería Huellitas",
            tipo: "peluqueria_canina",
            total_resenas: 0,
            calificacion_promedio: 0,
            verificado: false,
            confirmacion_automatica: true,
            distancia_km: 0.34,
            sucursal_cercana: { id_sucursal: 7, nombre: "Sede Centro", direccion: "Cra 19" },
          }),
        ],
      });
      renderRuta("/");

      const lista = await screen.findByRole("list", { name: "Negocios cercanos" });
      expect(busquedas[0]?.get("lat")).toBe("9.30472");
      expect(busquedas[0]?.get("lng")).toBe("-75.39778");
      expect(screen.getByText("2 negocios cerca de Sincelejo.")).toBeInTheDocument();

      const [patitas, huellitas] = within(lista).getAllByRole("listitem");
      const p = within(patitas!);
      expect(p.getByRole("heading", { name: "Clínica Veterinaria Patitas" })).toBeInTheDocument();
      expect(p.getByText("Veterinaria")).toBeInTheDocument();
      expect(p.getByText("Verificado")).toBeInTheDocument();
      expect(p.getByText("4,7")).toBeInTheDocument();
      expect(p.getByText("(12 reseñas)")).toBeInTheDocument();
      expect(p.getByText("a 1,8 km")).toBeInTheDocument();
      expect(p.queryByText("Confirmación inmediata")).toBeNull();
      expect(p.getByRole("button", { name: "Reservar desde la app · próximamente" })).toBeDisabled();

      const h = within(huellitas!);
      expect(h.getByText("Peluquería canina")).toBeInTheDocument();
      expect(h.getByText("Sin reseñas aún")).toBeInTheDocument();
      expect(h.getByText("a 350 m")).toBeInTheDocument();
      expect(h.getByText("Confirmación inmediata")).toBeInTheDocument();
    });

    it("filtra por tipo de negocio", async () => {
      const usuario = userEvent.setup();
      const { busquedas } = apiPublica();
      renderRuta("/");
      await screen.findByRole("list", { name: "Negocios cercanos" });

      await usuario.click(screen.getByRole("button", { name: "Peluquerías" }));
      await waitFor(() => expect(busquedas.at(-1)?.get("tipo")).toBe("peluqueria_canina"));
      expect(screen.getByRole("button", { name: "Peluquerías" })).toHaveAttribute("aria-pressed", "true");
    });

    it("con la ubicación permitida busca cerca del usuario", async () => {
      const usuario = userEvent.setup();
      geolocalizacion({ lat: 9.29, lng: -75.39 });
      const { busquedas } = apiPublica();
      renderRuta("/");
      await screen.findByRole("list", { name: "Negocios cercanos" });

      await usuario.click(screen.getByRole("button", { name: "Usar mi ubicación" }));
      await waitFor(() => expect(busquedas.at(-1)?.get("lat")).toBe("9.29"));
      expect(busquedas.at(-1)?.get("lng")).toBe("-75.39");
      expect(await screen.findByText("1 negocio cerca de tu ubicación.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ver Sincelejo" })).toBeInTheDocument();
    });

    it("si el usuario no da la ubicación, se queda en Sincelejo y lo explica", async () => {
      const usuario = userEvent.setup();
      geolocalizacion("denegada");
      const { busquedas } = apiPublica();
      renderRuta("/");
      await screen.findByRole("list", { name: "Negocios cercanos" });

      await usuario.click(screen.getByRole("button", { name: "Usar mi ubicación" }));
      expect(await screen.findByText(/No pudimos usar tu ubicación/)).toBeInTheDocument();
      expect(busquedas.every((b) => b.get("lat") === "9.30472")).toBe(true);
    });

    it("lejos de los negocios de PetCat ofrece ver Sincelejo", async () => {
      const usuario = userEvent.setup();
      geolocalizacion({ lat: 4.6, lng: -74.08 });
      apiPublica({ negocios: [] });
      renderRuta("/");

      await usuario.click(await screen.findByRole("button", { name: "Usar mi ubicación" }));
      expect(await screen.findByText("Todavía no hay negocios de PetCat a menos de 10 km de ti.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ver negocios en Sincelejo" })).toBeInTheDocument();
    });
  });

  describe("cifras", () => {
    it("muestra solo las que manda la API (las que superan el umbral)", async () => {
      apiPublica({ estadisticas: { negocios_activos: null, ciudades: null, citas_atendidas: 1250 } });
      renderRuta("/");
      const seccion = (await screen.findByRole("heading", { name: "PetCat en cifras" })).closest("section")!;
      expect(within(seccion).getByText("1.250")).toBeInTheDocument();
      expect(within(seccion).getByText("citas atendidas")).toBeInTheDocument();
      expect(within(seccion).queryByText("negocios activos")).toBeNull();
      expect(within(seccion).queryByText("ciudades")).toBeNull();
    });

    it("sin ninguna cifra sobre el umbral, la sección no aparece", async () => {
      apiPublica();
      renderRuta("/");
      await screen.findByRole("list", { name: "Negocios cercanos" });
      expect(screen.queryByRole("heading", { name: "PetCat en cifras" })).toBeNull();
    });
  });

  describe("reseñas", () => {
    it("muestra las reseñas reales con autor, negocio y mes de la visita", async () => {
      apiPublica({
        resenas: [
          resenaLandingDemo(),
          resenaLandingDemo({
            id_resena: 2,
            calificacion: 4,
            titulo: null,
            comentario: "Atención rápida en urgencias.",
            autor: "Camilo T.",
            negocio: { id_negocio: 4, nombre: "Salud Animal 24h", tipo: "clinica" },
            visita_verificada: "2026-11",
          }),
        ],
      });
      renderRuta("/");
      const seccion = (await screen.findByRole("heading", { name: "Lo que dicen los dueños" })).closest("section")!;
      const [primera, segunda] = within(seccion).getAllByRole("listitem");
      expect(within(primera!).getByText("Sofía G.")).toBeInTheDocument();
      expect(within(primera!).getByText("Clínica Veterinaria Patitas")).toBeInTheDocument();
      expect(within(primera!).getByText("Visita verificada · septiembre de 2026")).toBeInTheDocument();
      expect(within(primera!).getByRole("img", { name: "5 de 5 estrellas" })).toBeInTheDocument();
      expect(within(segunda!).getByText("“Atención rápida en urgencias.”")).toBeInTheDocument();
      expect(within(segunda!).getByRole("img", { name: "4 de 5 estrellas" })).toBeInTheDocument();
    });

    it("si la API no manda reseñas (menos que el mínimo), la sección no aparece", async () => {
      apiPublica({ resenas: [] });
      renderRuta("/");
      await screen.findByRole("list", { name: "Negocios cercanos" });
      expect(screen.queryByRole("heading", { name: "Lo que dicen los dueños" })).toBeNull();
    });
  });

  describe("pie de página", () => {
    it("muestra la política y el contacto de soporte configurado", async () => {
      apiPublica({
        configuracion: { soporte: { email: "soporte@petcat.com.co", whatsapp: "+57 300 123 4567" }, prueba_pro_dias: 14 },
      });
      renderRuta("/");
      const pie = screen.getByRole("contentinfo");
      expect(await within(pie).findByRole("link", { name: "soporte@petcat.com.co" })).toHaveAttribute(
        "href",
        "mailto:soporte@petcat.com.co",
      );
      expect(within(pie).getByRole("link", { name: "WhatsApp +57 300 123 4567" })).toHaveAttribute(
        "href",
        "https://wa.me/573001234567",
      );
      expect(within(pie).getByRole("link", { name: "Política de tratamiento de datos" })).toHaveAttribute(
        "href",
        "https://petcat.co/politica",
      );
      expect(within(pie).getByText("Versión 1.0")).toBeInTheDocument();
      expect(within(pie).getByText("© PetCat · Sincelejo, Sucre")).toBeInTheDocument();
    });

    it("sin soporte configurado no muestra la sección de soporte", async () => {
      apiPublica({ configuracion: { soporte: { email: null, whatsapp: null }, prueba_pro_dias: 14 } });
      renderRuta("/");
      const pie = screen.getByRole("contentinfo");
      await within(pie).findByText("Versión 1.0");
      expect(within(pie).queryByRole("heading", { name: "Soporte" })).toBeNull();
      expect(within(pie).queryByRole("link", { name: /@/ })).toBeNull();
    });
  });

  it("la banda para negocios lleva a /para-negocios", async () => {
    const usuario = userEvent.setup();
    apiPublica();
    const { router } = renderRuta("/");
    await usuario.click(screen.getByRole("link", { name: "Conoce PetCat para negocios" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: /Agenda en línea, menos inasistencias/ }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/para-negocios");
  });
});

describe("para negocios (/para-negocios)", () => {
  it("muestra los planes reales con precios en COP y la prueba Pro de la API", async () => {
    apiPublica();
    renderRuta("/para-negocios");
    const seccion = (await screen.findByRole("heading", { name: "Empieza gratis, crece con Pro" })).closest(
      "section",
    )!;
    const planes = await within(seccion).findAllByRole("heading", { level: 3 });
    expect(planes.map((p) => p.textContent)).toEqual(["Gratuito", "Pro", "Enterprise"]);
    expect(within(seccion).getByText("Gratis")).toBeInTheDocument();
    expect(within(seccion).getByText(/120\.000/)).toBeInTheDocument();
    expect(within(seccion).getByText(/o \$\s?1\.080\.000 al año/)).toBeInTheDocument();
    expect(within(seccion).getByText("Prueba gratis de 14 días")).toBeInTheDocument();
    expect(within(seccion).getByText("1 sede · 3 empleados")).toBeInTheDocument();
    expect(within(seccion).getByRole("link", { name: "Probar Pro 14 días gratis" })).toHaveAttribute(
      "href",
      "/registro",
    );
    expect(within(seccion).getByRole("link", { name: "Hablar con PetCat" })).toHaveAttribute(
      "href",
      "mailto:soporte@petcat.com.co?subject=Plan%20Enterprise%20de%20PetCat",
    );
  });

  it("lleva al registro y al login; con sesión, al panel", async () => {
    apiPublica();
    const { unmount } = renderRuta("/para-negocios");
    const crear = await screen.findAllByRole("link", { name: "Crear mi negocio gratis" });
    expect(crear[0]).toHaveAttribute("href", "/registro");
    expect(screen.getAllByRole("link", { name: "Iniciar sesión" })[0]).toHaveAttribute("href", "/login");
    unmount();

    renderRuta("/para-negocios", { usuario: usuarioDemo() });
    await screen.findAllByRole("link", { name: "Crear mi negocio gratis" });
    expect(screen.queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Ir al panel" })[0]).toHaveAttribute("href", "/panel");
  });
});
