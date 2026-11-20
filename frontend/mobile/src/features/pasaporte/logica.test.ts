import { mascotaDemo, registroDemo as registro, vacunaDemo as vacuna } from "../../../test/msw/handlers";
import {
  codigoParaLector,
  construirAnillo,
  construirLinea,
  construirSellos,
  diasEntre,
  estadoPorProxima,
  etiquetaSello,
  etiquetaTarjeta,
  LARGO_MRZ,
  lineaMrz,
  microchipEnGrupos,
  nombreCorto,
  textoSello,
  type FilaLinea,
} from "./logica";

const HOY = "2026-11-20";

describe("número de pasaporte, microchip y línea tipo pasaporte", () => {
  it("el lector deletrea el número por grupos", () => {
    expect(codigoParaLector("PC-7KQ4-M9XR")).toBe("P C, 7 K Q 4, M 9 X R");
  });

  it("el microchip va en bloques de tres; si no es solo números, tal cual", () => {
    expect(microchipEnGrupos("985141000123456")).toBe("985 141 000 123 456");
    expect(microchipEnGrupos("985 1410")).toBe("985 141 0");
    expect(microchipEnGrupos("AB-12")).toBe("AB-12");
  });

  it("la línea tipo pasaporte: sin tildes, en mayúsculas, rellena con < y de largo fijo", () => {
    const linea = lineaMrz({
      nombre: "Ñoño José",
      raza: "Golden Retriever",
      especie: "perro",
      microchip: "985141000123456",
    });
    expect(linea).toBe("PC<COL<NONO<JOSE<<GOLDEN<RE<<985141000123456");
    expect(linea).toHaveLength(LARGO_MRZ);
    expect(lineaMrz({ nombre: "Michi", raza: null, especie: "gato", microchip: null })).toMatch(
      /^PC<COL<MICHI<<GATO<+$/,
    );
  });
});

describe("sellos", () => {
  it("uno por dosis vigente (no las anteriores), con su estado y su origen", () => {
    const sellos = construirSellos(
      [
        vacuna({ id_vacuna: 1, estado: "al_dia" }),
        vacuna({ id_vacuna: 2, estado: "no_aplica" }),
        vacuna({
          id_vacuna: 3,
          nombre_vacuna: "Múltiple (DHPPi+L)",
          estado: "proximo",
          fecha_proxima: "2026-12-01",
        }),
        vacuna({
          id_vacuna: 4,
          nombre_vacuna: "Bordetella",
          estado: "vencido",
          fecha_proxima: "2026-11-01",
          registrada_por: "dueno",
          negocio: null,
        }),
      ],
      null,
      { hoy: HOY },
    );
    expect(sellos.map((s) => [s.corto, s.estado, s.tono])).toEqual([
      ["RABIA", "aplicada", "teal"],
      ["MÚLTIPLE", "proxima", "sun"],
      ["BORDETEL.", "vencida", "danger"],
    ]);
    expect(sellos[2]!.origen).toBe("dueno");
  });

  it("la desparasitación: su estado por la próxima fecha, con la misma regla de 30 días", () => {
    expect(estadoPorProxima(null, HOY)).toBe("aplicada");
    expect(estadoPorProxima("2026-12-20", HOY)).toBe("proxima");
    expect(estadoPorProxima("2026-12-21", HOY)).toBe("aplicada");
    expect(estadoPorProxima("2026-11-19", HOY)).toBe("vencida");
    const [sello] = construirSellos(
      [],
      registro({ tipo: "desparasitacion", fecha: "2026-10-01", proximo_control: "2027-01-01" }),
      {
        hoy: HOY,
      },
    );
    expect(sello).toMatchObject({
      corto: "DESPARAS.",
      estado: "aplicada",
      tono: "info",
      tipo: "desparasitacion",
    });
  });

  it("«En memoria»: todos como historial aplicado y en gris, sin vencidas ni próximas", () => {
    const sellos = construirSellos(
      [vacuna({ estado: "vencido" })],
      registro({ tipo: "desparasitacion", proximo_control: "2026-01-01" }),
      {
        fallecido: true,
        hoy: HOY,
      },
    );
    expect(sellos.map((s) => [s.estado, s.tono])).toEqual([
      ["aplicada", "memoria"],
      ["aplicada", "memoria"],
    ]);
  });

  it("texto del sello y su etiqueta completa para el lector", () => {
    const [aplicada, proxima, vencida] = construirSellos(
      [
        vacuna({ id_vacuna: 1 }),
        vacuna({ id_vacuna: 2, nombre_vacuna: "Parvovirus", estado: "proximo", fecha_proxima: "2026-12-01" }),
        vacuna({
          id_vacuna: 3,
          nombre_vacuna: "Moquillo",
          estado: "vencido",
          fecha_proxima: "2026-11-01",
          registrada_por: "dueno",
          negocio: null,
        }),
      ],
      null,
      { hoy: HOY },
    );
    expect(textoSello(aplicada!)).toBe("12·12·25");
    expect(textoSello(proxima!)).toBe("Vence 1 dic");
    expect(textoSello(vencida!)).toBe("Venció 1 nov");
    expect(etiquetaSello(aplicada!)).toBe(
      "Rabia. Aplicada el vie 12 dic 2025. Próxima dosis el sáb 12 dic 2026. Registrada por Clínica Patitas.",
    );
    expect(etiquetaSello(vencida!)).toBe(
      "Moquillo. Vencida. Aplicada el vie 12 dic 2025. Venció el dom 1 nov 2026. Registrada por ti.",
    );
  });

  it("nombre corto: primera palabra, en mayúsculas, hasta 9 letras", () => {
    expect(nombreCorto("Múltiple (DHPPi+L)")).toBe("MÚLTIPLE");
    expect(nombreCorto("Leptospirosis")).toBe("LEPTOSPI.");
  });
});

describe("anillo", () => {
  it("sin vacunas vigentes, no hay anillo", () => {
    expect(construirAnillo([vacuna({ estado: "no_aplica" })], HOY)).toBeNull();
  });

  it("todas al día: el refuerzo más cercano", () => {
    expect(
      construirAnillo(
        [
          vacuna({ id_vacuna: 1, fecha_proxima: "2027-03-01" }),
          vacuna({ id_vacuna: 2, nombre_vacuna: "Parvovirus", fecha_proxima: "2026-12-12" }),
        ],
        HOY,
      ),
    ).toEqual({
      alDia: 2,
      total: 2,
      tono: "ok",
      titulo: "2 de 2 vacunas al día",
      detalle: "Próximo refuerzo: Parvovirus · 12 dic",
    });
  });

  it("con una próxima: aviso; con vencidas: alerta, cuál y desde cuándo", () => {
    expect(construirAnillo([vacuna({ estado: "proximo", fecha_proxima: "2026-12-01" })], HOY)?.tono).toBe(
      "aviso",
    );
    expect(
      construirAnillo(
        [
          vacuna({ id_vacuna: 1 }),
          vacuna({ id_vacuna: 2, nombre_vacuna: "Moquillo", estado: "vencido", fecha_proxima: "2026-10-01" }),
          vacuna({
            id_vacuna: 3,
            nombre_vacuna: "Parvovirus",
            estado: "vencido",
            fecha_proxima: "2026-11-01",
          }),
        ],
        HOY,
      ),
    ).toEqual({
      alDia: 1,
      total: 3,
      tono: "alerta",
      titulo: "1 de 3 vacunas al día",
      detalle: "Moquillo venció el 1 oct (y 1 más)",
    });
  });
});

describe("etiqueta de la tarjeta (todo en texto)", () => {
  const anillo = { alDia: 6, total: 6, tono: "ok" as const, titulo: "", detalle: null };

  it("nombre, número deletreado, especie, nacimiento, microchip y vacunas", () => {
    const m = mascotaDemo({
      nombre: "Max",
      raza: "Golden",
      microchip: "985141000123456",
      fecha_nacimiento: "2022-03-08",
    }) as never;
    expect(etiquetaTarjeta(m, anillo)).toBe(
      "Pasaporte PetCat de Max. Número P C, 7 K Q 4, M 9 X R. Perro, Golden. Nació el mar 8 mar 2022. " +
        "Microchip 985 141 000 123 456. Vacunas: 6 de 6 al día.",
    );
  });

  it("sin microchip ni vacunas; «En memoria»", () => {
    const sin = mascotaDemo({ microchip: null, fecha_nacimiento: null }) as never;
    expect(etiquetaTarjeta(sin, null)).toMatch(/Sin microchip registrado\. Sin vacunas registradas\.$/);
    const memoria = mascotaDemo({ fallecido: true, fecha_fallecimiento: "2026-11-10" }) as never;
    expect(etiquetaTarjeta(memoria, null)).toMatch(/En memoria, desde el mar 10 nov 2026\.$/);
  });
});

describe("línea de vida", () => {
  const items = (filas: FilaLinea[]) =>
    filas.map((f) => (f.tipo === "anio" ? f.anio : `${f.item.fecha} ${f.item.titulo}`));

  const vacunas = [
    vacuna({ id_vacuna: 1, nombre_vacuna: "Rabia", fecha_aplicacion: "2025-12-12", id_historial_medico: 50 }),
    vacuna({ id_vacuna: 2, nombre_vacuna: "Múltiple", fecha_aplicacion: "2025-02-03", lote: "MV-0912" }),
  ];
  const registros = [
    registro({
      id_historial: 60,
      fecha: "2026-10-14",
      tipo: "consulta_general",
      peso_registro: 28.4,
      diagnostico: "Todo normal",
    }),
    registro({
      id_historial: 55,
      fecha: "2026-10-01",
      tipo: "desparasitacion",
      medicamentos_prescritos: "Drontal Plus",
    }),
    // La vacuna 1 lo enlaza: no se repite.
    registro({ id_historial: 50, fecha: "2025-12-12", tipo: "vacunacion" }),
    // Ninguna vacuna lo enlaza: se ve.
    registro({ id_historial: 40, fecha: "2025-06-01", tipo: "vacunacion" }),
  ];

  it("todo: intercalado del más reciente al más antiguo, con años y sin repetir la vacunación enlazada", () => {
    expect(items(construirLinea({ filtro: "todo", vacunas, registros, hayMas: false }))).toEqual([
      "2026",
      "2026-10-14 Consulta general",
      "2026-10-01 Desparasitación",
      "2025",
      "2025-12-12 Rabia",
      "2025-06-01 Vacunación",
      "2025-02-03 Múltiple",
    ]);
  });

  it("con páginas pendientes, las vacunas solo hasta el registro más antiguo cargado (nada se reordena)", () => {
    const pagina1 = registros.slice(0, 2);
    expect(items(construirLinea({ filtro: "todo", vacunas, registros: pagina1, hayMas: true }))).toEqual([
      "2026",
      "2026-10-14 Consulta general",
      "2026-10-01 Desparasitación",
    ]);
  });

  it("vacunas: solo las dosis (también las anteriores) y sin el historial", () => {
    expect(items(construirLinea({ filtro: "vacunas", vacunas, registros, hayMas: true }))).toEqual([
      "2025",
      "2025-12-12 Rabia",
      "2025-02-03 Múltiple",
    ]);
  });

  it("detalle en una línea y lo que se ve al expandir", () => {
    const filas = construirLinea({ filtro: "todo", vacunas, registros, hayMas: false });
    const consulta = filas.find((f) => f.tipo === "item" && f.item.clase === "consulta");
    const multiple = filas.find((f) => f.tipo === "item" && f.item.titulo === "Múltiple");
    expect(consulta?.tipo === "item" && consulta.item).toMatchObject({
      detalle: "Clínica Patitas · Peso 28,4 kg",
      estado: "Atendida",
      extra: [{ etiqueta: "Diagnóstico", valor: "Todo normal" }],
    });
    expect(multiple?.tipo === "item" && multiple.item.detalle).toBe("Lote MV-0912 · Clínica Patitas");
  });

  it("días entre fechas", () => {
    expect(diasEntre("2026-11-20", "2026-12-20")).toBe(30);
    expect(diasEntre("2026-11-20", "2026-11-19")).toBe(-1);
  });
});
