import type { NegocioBusqueda } from "@/api/types";
import { leerEnv } from "@/lib/env";

import { negocioBusquedaDemo } from "../../../test/msw/handlers";
import {
  aperturaDeSede,
  categoriaDe,
  distanciaKm,
  enlacesComoLlegar,
  etiquetaNegocio,
  etiquetaPin,
  formatearDistancia,
  horarioSemanal,
  pinesDe,
  precioDesde,
  textoApertura,
  textoDuracion,
  textoPrecio,
  tiposDeFiltros,
} from "./logica";
import { crearHtmlMapa, origenTeselas } from "./mapa/html";
import { decidirNavegacion } from "./mapa/navegacion";
import { leerMensaje, scriptPara } from "./mapa/protocolo";

const negocio = (cambios: Record<string, unknown> = {}, sucursal: Record<string, unknown> = {}) =>
  negocioBusquedaDemo(cambios, sucursal) as unknown as NegocioBusqueda;

describe("filtros, categorías y textos", () => {
  it("Veterinarias agrupa veterinaria y clínica; sin filtros, todos los tipos", () => {
    expect(tiposDeFiltros({ abiertoAhora: false, veterinarias: true, peluqueria: true })).toEqual([
      "veterinaria",
      "clinica",
      "peluqueria_canina",
    ]);
    expect(tiposDeFiltros({ abiertoAhora: true, veterinarias: false, peluqueria: false })).toEqual([]);
    expect([
      categoriaDe("clinica"),
      categoriaDe("peluqueria_canina"),
      categoriaDe("tienda_mascotas"),
      categoriaDe("guarderia"),
    ]).toEqual(["veterinaria", "peluqueria", "tienda", "otro"]);
  });

  it("distancia, calificación del pin y apertura", () => {
    expect([
      formatearDistancia(0.004),
      formatearDistancia(0.347),
      formatearDistancia(1.234),
      formatearDistancia(12.6),
    ]).toEqual(["10 m", "350 m", "1,2 km", "13 km"]);
    expect(etiquetaPin({ calificacion_promedio: 5, total_resenas: 3 })).toBe("5,0");
    expect(etiquetaPin({ calificacion_promedio: 0, total_resenas: 0 })).toBe("Nuevo");
    expect(textoApertura({ abierto_ahora: true, cierra_a: "19:00", abre_hoy_a: null })).toBe(
      "Abierto hasta 7:00 p. m.",
    );
    expect(textoApertura({ abierto_ahora: false, cierra_a: null, abre_hoy_a: "14:00" })).toBe(
      "Cerrado · abre a las 2:00 p. m.",
    );
    expect(textoApertura({ abierto_ahora: false, cierra_a: null, abre_hoy_a: null })).toBe("Cerrado");
  });

  it("el negocio en una frase para el lector; sin distancia si no es la del teléfono", () => {
    expect(etiquetaNegocio(negocio(), true)).toBe(
      "Clínica Vet Sabanas, Veterinaria. 4,9 estrellas, 128 reseñas. A 1,2 km. Abierto hasta 7:00 p. m.",
    );
    expect(etiquetaNegocio(negocio({ total_resenas: 0 }), false)).toBe(
      "Clínica Vet Sabanas, Veterinaria. Sin reseñas todavía. Abierto hasta 7:00 p. m.",
    );
  });

  it("pines: solo con coordenadas, con su categoría y calificación", () => {
    expect(pinesDe([negocio(), negocio({ id_negocio: 2, sucursal_cercana: null })])).toEqual([
      { id: 1, lat: 9.3047, lng: -75.3978, categoria: "veterinaria", etiqueta: "4,9" },
    ]);
  });

  it("cómo llegar: enlaces web de Google Maps y Waze con la coordenada", () => {
    expect(enlacesComoLlegar({ lat: 9.3047, lng: -75.3978 })).toEqual({
      google: "https://www.google.com/maps/dir/?api=1&destination=9.3047%2C-75.3978",
      waze: "https://waze.com/ul?ll=9.3047%2C-75.3978&navigate=yes",
    });
    expect(distanciaKm({ lat: 9.3047, lng: -75.3978 }, { lat: 9.3137, lng: -75.3978 })).toBeCloseTo(1, 1);
  });
});

describe("perfil: horario y precios", () => {
  const partido = [1, 2, 3].flatMap((d) => [
    { dia_semana: d, hora_apertura: "08:00", hora_cierre: "12:00" },
    { dia_semana: d, hora_apertura: "12:00", hora_cierre: "13:00" },
    { dia_semana: d, hora_apertura: "14:00", hora_cierre: "18:00" },
  ]);

  it("abierto o cerrado en hora de Bogotá (las pruebas corren en Tokio), con los rangos unidos", () => {
    // Miércoles 18 nov 2026, 12:30 en Bogotá = 17:30 UTC.
    expect(aperturaDeSede(partido, new Date("2026-11-18T17:30:00Z"))).toEqual({
      abierto_ahora: true,
      cierra_a: "13:00",
      abre_hoy_a: null,
    });
    expect(aperturaDeSede(partido, new Date("2026-11-18T18:30:00Z"))).toEqual({
      abierto_ahora: false,
      cierra_a: null,
      abre_hoy_a: "14:00",
    });
    // Domingo: cerrado.
    expect(aperturaDeSede(partido, new Date("2026-11-22T15:00:00Z"))).toEqual({
      abierto_ahora: false,
      cierra_a: null,
      abre_hoy_a: null,
    });
  });

  it("horario de la semana, de lunes a domingo", () => {
    const semana = horarioSemanal(partido);
    expect(semana[0]).toEqual({ dia: "Lunes", texto: "8:00 a. m. a 1:00 p. m. y 2:00 p. m. a 6:00 p. m." });
    expect(semana.at(-1)).toEqual({ dia: "Domingo", texto: "Cerrado" });
    expect(semana).toHaveLength(7);
  });

  it("precios y duración", () => {
    expect(textoPrecio({ precio_actual: 45000, precio_maximo: null, tipo_precio: "fijo" })).toBe("$45.000");
    expect(textoPrecio({ precio_actual: 45000, precio_maximo: 60000, tipo_precio: "variable" })).toBe(
      "$45.000 a $60.000",
    );
    expect(textoPrecio({ precio_actual: 45000, precio_maximo: null, tipo_precio: "variable" })).toBe(
      "Desde $45.000",
    );
    expect(textoPrecio({ precio_actual: 20000, precio_maximo: null, tipo_precio: "por_hora" })).toBe(
      "$20.000 por hora",
    );
    expect(precioDesde([{ precio_actual: 45000 }, { precio_actual: 38000 }])).toBe(38000);
    expect(precioDesde([])).toBeNull();
    expect([textoDuracion(30), textoDuracion(60), textoDuracion(90)]).toEqual([
      "30 min",
      "1 h",
      "1 h 30 min",
    ]);
  });
});

describe("módulo del mapa", () => {
  it("mensajes del mapa: solo los válidos; los demás se ignoran", () => {
    expect(leerMensaje('{"tipo":"pin","id":7}')).toEqual({ tipo: "pin", id: 7 });
    expect(leerMensaje('{"tipo":"teselas","estado":"error"}')).toEqual({ tipo: "teselas", estado: "error" });
    expect(leerMensaje('{"tipo":"pin","id":"7"}')).toBeNull();
    expect(leerMensaje('{"tipo":"otro"}')).toBeNull();
    expect(leerMensaje("no es json")).toBeNull();
  });

  it("al mapa va JSON (sin interpolar texto)", () => {
    expect(scriptPara({ tipo: "seleccionar", id: 3 })).toBe(
      'window.__petcat && window.__petcat.recibir({"tipo":"seleccionar","id":3}); true;',
    );
  });

  it("la CSP permite las imágenes del origen de las teselas (con subdominios {s})", () => {
    expect(origenTeselas("https://tile.openstreetmap.org/{z}/{x}/{y}.png")).toBe(
      "https://tile.openstreetmap.org",
    );
    expect(origenTeselas("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")).toBe(
      "https://*.tile.openstreetmap.org",
    );
    expect(origenTeselas("https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=abc")).toBe(
      "https://api.maptiler.com",
    );

    const colores = {
      fondoPin: "#fff",
      textoPin: "#000",
      borde: "#ccc",
      veterinaria: "#0f0",
      peluqueria: "#f00",
      tienda: "#00f",
      otro: "#999",
      seleccionado: "#f80",
      textoSeleccionado: "#300",
      ubicacion: "#08f",
    };
    const html = crearHtmlMapa({
      teselas: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      atribucion: "</script><b>x</b>",
      centro: { lat: 9.3, lng: -75.4 },
      zoom: 14,
      colores,
    });
    expect(html).toContain("img-src https://*.tile.openstreetmap.org data:");
    expect(html).toContain("default-src 'none'");
    // La configuración no puede cerrar el <script>.
    expect(html).not.toContain("</script><b>");
    expect(html).toContain("BSD 2-Clause License");
  });

  it("el WebView solo carga su página; los enlaces se abren fuera", () => {
    expect(decidirNavegacion("about:blank")).toEqual({ cargar: true, abrirFuera: null });
    expect(decidirNavegacion("https://www.openstreetmap.org/copyright")).toEqual({
      cargar: false,
      abrirFuera: "https://www.openstreetmap.org/copyright",
    });
    expect(decidirNavegacion("javascript:alert(1)")).toEqual({ cargar: false, abrirFuera: null });
    expect(decidirNavegacion("file:///data/data/x")).toEqual({ cargar: false, abrirFuera: null });
  });

  it("configuración: teselas de OpenStreetMap por defecto; una plantilla sin {z}/{x}/{y} es un error", () => {
    const contexto = { plataforma: "android", hostUri: "192.168.1.5:8081" };
    expect(leerEnv({}, contexto).mapa).toEqual({
      teselas: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      atribucion: "© OpenStreetMap",
    });
    expect(
      leerEnv(
        {
          EXPO_PUBLIC_MAP_TILES_URL: "https://t.example/{z}/{x}/{y}.png",
          EXPO_PUBLIC_MAP_ATTRIBUTION: "© Ejemplo",
        },
        contexto,
      ).mapa,
    ).toEqual({
      teselas: "https://t.example/{z}/{x}/{y}.png",
      atribucion: "© Ejemplo",
    });
    expect(() => leerEnv({ EXPO_PUBLIC_MAP_TILES_URL: "https://t.example/mapa.png" }, contexto)).toThrow(
      /\{z\}, \{x\} y \{y\}/,
    );
    expect(() => leerEnv({ EXPO_PUBLIC_MAP_TILES_URL: "ftp://t.example/{z}/{x}/{y}" }, contexto)).toThrow(
      /http\(s\)/,
    );
  });
});
