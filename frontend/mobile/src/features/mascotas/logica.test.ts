import { aplicarMascaraFecha, esFutura, fechaApiAMascara, mascaraAFechaApi } from "@/lib/fechaMascara";
import { describirPeso, formatearEdad, formatearPeso, textoPlazo } from "@/lib/mascotas";
import { saludo } from "@/lib/saludo";

import { barrasPorMes } from "./components/GraficoPeso";
import { aCambios, aDatos, desdeMascota, leerPeso, mascotaSchema, VACIO, type MascotaForm } from "./formulario";
import { buscarRazas } from "./razas";
import { mascotaDemo } from "../../../test/msw/handlers";

describe("edad y peso", () => {
  it.each([
    [null, null],
    [0, "Menos de 1 mes"],
    [1, "1 mes"],
    [8, "8 meses"],
    [12, "1 año"],
    [42, "3 años"],
  ])("formatearEdad(%p) = %p", (meses, texto) => expect(formatearEdad(meses)).toBe(texto));

  it("el peso va con coma decimal", () => {
    expect(formatearPeso(28.4)).toBe("28,4 kg");
    expect(formatearPeso(3)).toBe("3 kg");
    expect(formatearPeso(null)).toBeNull();
    expect(leerPeso("28,4")).toBe(28.4);
    expect(leerPeso(" ")).toBeNull();
  });
});

describe("describirPeso (texto del gráfico para el lector)", () => {
  it("sin registros", () => {
    expect(describirPeso([])).toEqual({ titulo: null, descripcion: "Sin registros de peso todavía." });
  });

  it("subió en 3 meses: cuánto, de cuánto a cuánto y la fecha del último", () => {
    const { titulo, descripcion } = describirPeso([
      { fecha: "2026-08-12", peso: 27.8, origen: "historial" },
      { fecha: "2026-11-12", peso: 28.4, origen: "dueno" },
    ]);
    expect(titulo).toBe("Subió 0,6 kg en 3 meses");
    expect(descripcion).toBe("Subió 0,6 kg en 3 meses, de 27,8 a 28,4 kg. Último registro: jue 12 nov.");
  });

  it("bajó y estable", () => {
    expect(
      describirPeso([
        { fecha: "2026-10-01", peso: 30, origen: "dueno" },
        { fecha: "2026-11-01", peso: 29, origen: "dueno" },
      ]).titulo,
    ).toBe("Bajó 1 kg en 1 mes");
    expect(
      describirPeso([
        { fecha: "2026-11-01", peso: 5, origen: "dueno" },
        { fecha: "2026-11-05", peso: 5, origen: "dueno" },
      ]).titulo,
    ).toBe("Estable en menos de un mes");
  });

  it("las barras toman el último peso de cada mes, hasta 6 meses", () => {
    const puntos = Array.from({ length: 8 }, (_, i) => ({
      fecha: `2026-${String(i + 1).padStart(2, "0")}-15`,
      peso: 10 + i,
      origen: "dueno" as const,
    }));
    puntos.push({ fecha: "2026-08-20", peso: 99, origen: "dueno" });
    const barras = barrasPorMes(puntos);
    expect(barras).toHaveLength(6);
    expect(barras.at(-1)).toEqual({ etiqueta: "Ago", peso: 99 });
    expect(barras[0]!.etiqueta).toBe("Mar");
  });
});

describe("textos de plazo y saludo (hora de Bogotá, con el equipo en Tokio)", () => {
  it.each([
    [0, "Hoy"],
    [1, "Mañana"],
    [20, "En 20 días"],
    [-1, "Venció ayer"],
    [-3, "Venció hace 3 días"],
  ])("textoPlazo(%p) = %p", (dias, texto) => expect(textoPlazo(dias)).toBe(texto));

  it.each([
    ["2026-11-19T10:00:00Z", "Buenos días"], // 5:00 en Bogotá
    ["2026-11-19T17:00:00Z", "Buenas tardes"], // 12:00
    ["2026-11-20T00:00:00Z", "Buenas noches"], // 19:00
    ["2026-11-19T09:59:00Z", "Buenas noches"], // 4:59
  ])("%s → %s", (iso, texto) => expect(saludo(new Date(iso))).toBe(texto));
});

describe("campo de fecha dd/mm/aaaa", () => {
  it("pone las barras mientras se escribe", () => {
    expect(aplicarMascaraFecha("1")).toBe("1");
    expect(aplicarMascaraFecha("1503")).toBe("15/03");
    expect(aplicarMascaraFecha("15032021")).toBe("15/03/2021");
    expect(aplicarMascaraFecha("15/03/2021999")).toBe("15/03/2021");
  });

  it("solo acepta fechas reales", () => {
    expect(mascaraAFechaApi("15/03/2021")).toBe("2021-03-15");
    expect(mascaraAFechaApi("31/02/2021")).toBeNull();
    expect(mascaraAFechaApi("15/03/21")).toBeNull();
    expect(fechaApiAMascara("2021-03-15")).toBe("15/03/2021");
    expect(fechaApiAMascara(null)).toBe("");
  });

  it("futura según el día de Bogotá", () => {
    // 2026-11-20 03:00 en Tokio = 2026-11-19 13:00 en Bogotá.
    const ahora = new Date("2026-11-19T18:00:00Z");
    expect(esFutura("2026-11-19", ahora)).toBe(false);
    expect(esFutura("2026-11-20", ahora)).toBe(true);
  });
});

describe("razas", () => {
  it("sugiere sin tildes ni mayúsculas, primero las que empiezan así", () => {
    const sugerencias = buscarRazas("perro", "pas");
    expect(sugerencias[0]).toMatch(/^Pas/);
    expect(buscarRazas("perro", "")).toEqual([]);
    expect(buscarRazas("pez", "a")).toEqual([]);
  });

  it("no sugiere la raza ya escrita completa", () => {
    expect(buscarRazas("perro", "Labrador")).not.toContain("Labrador");
  });
});

describe("formulario", () => {
  const valido: MascotaForm = { ...VACIO, nombre: " Luna ", especie: "perro" };

  it("aplica las reglas de la API", () => {
    expect(mascotaSchema.safeParse(valido).success).toBe(true);
    const errores = (cambios: Partial<MascotaForm>) =>
      mascotaSchema.safeParse({ ...valido, ...cambios }).error?.issues.map((i) => i.message);
    expect(errores({ nombre: "  " })).toEqual(["Escribe su nombre"]);
    expect(errores({ especie: undefined })).toEqual(["Elige qué animal es"]);
    expect(errores({ peso: "0" })).toEqual(["El peso debe ser mayor que 0"]);
    expect(errores({ peso: "28.456" })).toEqual(["Escribe el peso en kilos, como 28,4"]);
    expect(errores({ fecha_nacimiento: "31/02/2021" })).toEqual(["Escribe una fecha real, como 15/03/2021"]);
    expect(errores({ fecha_nacimiento: "01/01/2999" })).toEqual(["No puede ser una fecha futura"]);
  });

  it("crear: omite los vacíos y convierte fecha y peso", () => {
    expect(aDatos({ ...valido, fecha_nacimiento: "10/05/2023", peso: "28,4", raza: " " })).toEqual({
      nombre: "Luna",
      especie: "perro",
      sexo: "desconocido",
      esterilizado: false,
      tiene_alergias: false,
      compartir_historial: true,
      fecha_nacimiento: "2023-05-10",
      peso: 28.4,
    });
  });

  it("editar: solo lo que cambió; un campo vaciado va como null", () => {
    const inicial = desdeMascota(mascotaDemo({ color: "Dorado" }) as never);
    expect(aCambios(inicial, inicial)).toEqual({});
    expect(aCambios({ ...inicial, peso: "29", color: "" }, inicial)).toEqual({ peso: 29, color: null });
  });

  it("sin alergias, el detalle se borra", () => {
    const inicial = desdeMascota(mascotaDemo({ tiene_alergias: true, alergias_detalle: "Pollo" }) as never);
    expect(aCambios({ ...inicial, tiene_alergias: false }, inicial)).toEqual({
      tiene_alergias: false,
      alergias_detalle: null,
    });
  });
});
