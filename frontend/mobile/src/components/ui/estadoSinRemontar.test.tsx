import { fireEvent, render, screen } from "nativewind/test";
import { useState, type ComponentType } from "react";
import { Pressable } from "react-native";

import type { Especie } from "@/api/types";
import { SelectorEspecie } from "@/features/mascotas/components/SelectorEspecie";
import { SelectorMascotas } from "@/features/mascotas/components/SelectorMascotas";

import { mascotaDemo } from "../../../test/msw/handlers";
import { Checkbox } from "./Checkbox";
import { Chip } from "./Chip";
import { MedidorPassword } from "./MedidorPassword";
import { Segmented } from "./Segmented";
import { Toggle } from "./Toggle";

// NativeWind "actualiza" (remonta) un componente si después del primer render recibe clases
// que necesitan algo que no tenía: variables CSS (shadow-*, ring-*, transform), transiciones o
// pseudo-clases. En desarrollo imprime un aviso que serializa sus props, hijos incluidos: en
// Android eso terminó en pantalla roja ("Couldn't find a LinkingContext context") al elegir el
// sexo en Nueva mascota, por el `shadow-sm` del Segmented. Lo que cambia con el estado va en
// style con los tokens.

// Sin los tipos de Node en el proyecto (cambiarían los de la app): solo lo que se usa aquí.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync: (ruta: string) => string[];
  readFileSync: (ruta: string, codificacion: "utf8") => string;
  statSync: (ruta: string) => { isDirectory: () => boolean };
}>("fs");
const { join, relative } = jest.requireActual<{
  join: (...partes: string[]) => string;
  relative: (desde: string, hasta: string) => string;
}>("path");

const RAIZ = join(__dirname, "../../..");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- configuración CommonJS
const { theme } = require("../../../tailwind.config");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [ruta] : [];
  });
}

const FUENTES = [...archivos(join(RAIZ, "src")), ...archivos(join(RAIZ, "app"))];

/** Todas las palabras de los textos entre comillas del código: el safelist de Tailwind. */
const CLASES = [
  ...new Set(
    FUENTES.flatMap((f) => readFileSync(f, "utf8").match(/["`'][^"`'\n]*["`']/g) ?? [])
      .flatMap((t) => t.slice(1, -1).split(/\s+/))
      .filter((c) => /^-?[a-z][a-z0-9:/.\-[\]%]*$/.test(c)),
  ),
  "shadow-sm", // la del control
];

let avisos: string[];
beforeEach(() => {
  avisos = [];
  const stringify = JSON.stringify;
  // El aviso de NativeWind recorre los hijos sin límite y en Jest agota la memoria: se corta
  // ahí y se registra como fallo.
  jest.spyOn(JSON, "stringify").mockImplementation(function (
    this: unknown,
    ...args: Parameters<typeof stringify>
  ) {
    if (new Error().stack?.includes("printUpgradeWarning")) {
      avisos.push("NativeWind tuvo que remontar el componente");
      return '"(omitido)"';
    }
    return stringify.apply(JSON, args);
  });
  jest.spyOn(console, "log").mockImplementation((...args) => {
    const texto = args.map(String).join(" ");
    if (texto.startsWith("CssInterop upgrade warning")) avisos.push(texto.split("\n").slice(0, 4).join(" "));
  });
});
afterEach(() => jest.restoreAllMocks());

async function cambiarEstado(Componente: ComponentType, tocar: () => unknown) {
  await render(<Componente />, { config: { theme, safelist: CLASES } });
  await fireEvent.press(tocar() as never);
  await fireEvent.press(tocar() as never);
}

function MalaPractica() {
  const [activa, setActiva] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="control"
      onPress={() => setActiva(!activa)}
      className={activa ? "bg-white shadow-sm" : ""}
    />
  );
}

function SegmentedDePrueba() {
  const [valor, setValor] = useState<"macho" | "hembra">("macho");
  return (
    <Segmented
      etiqueta="Sexo"
      valor={valor}
      onCambiar={setValor}
      opciones={[
        { valor: "macho", etiqueta: "Macho" },
        { valor: "hembra", etiqueta: "Hembra" },
      ]}
    />
  );
}

function ToggleDePrueba() {
  const [activo, setActivo] = useState(false);
  return <Toggle etiqueta="Esterilizado" activo={activo} onCambiar={setActivo} />;
}

function ChipDePrueba() {
  const [sel, setSel] = useState(false);
  return <Chip etiqueta="Conejo" seleccionado={sel} onPress={() => setSel((s) => !s)} />;
}

function CheckboxDePrueba() {
  const [marcado, setMarcado] = useState(false);
  return <Checkbox etiqueta="Acepto" marcado={marcado} onCambiar={setMarcado} />;
}

function EspecieDePrueba() {
  const [valor, setValor] = useState<Especie | undefined>(undefined);
  return <SelectorEspecie valor={valor} onCambiar={setValor} />;
}

const mascotas = [mascotaDemo(), mascotaDemo({ id_mascota: 2, nombre: "Milo" })] as never[];
function MascotasDePrueba() {
  const [actual, setActual] = useState(1);
  return <SelectorMascotas mascotas={mascotas} actual={actual} onElegir={setActual} puedeAgregar />;
}

function MedidorDePrueba() {
  const [password, setPassword] = useState("abc");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="escribir"
      onPress={() => setPassword((p) => p + "Xy9!")}
    >
      <MedidorPassword password={password} />
    </Pressable>
  );
}

describe("cambiar de estado no obliga a NativeWind a remontar el componente", () => {
  it("control: una sombra que aparece al seleccionar sí se detecta", async () => {
    await cambiarEstado(MalaPractica, () => screen.getByRole("button", { name: "control" }));
    expect(avisos.length).toBeGreaterThan(0);
  });

  it.each([
    ["Segmented", SegmentedDePrueba, () => screen.getByRole("radio", { name: "Hembra" })],
    ["Toggle", ToggleDePrueba, () => screen.getByRole("switch", { name: "Esterilizado" })],
    ["Chip", ChipDePrueba, () => screen.getByRole("button", { name: "Conejo" })],
    ["Checkbox", CheckboxDePrueba, () => screen.getByRole("checkbox", { name: "Acepto" })],
    ["SelectorEspecie", EspecieDePrueba, () => screen.getByRole("radio", { name: "Otro" })],
    ["SelectorMascotas", MascotasDePrueba, () => screen.getByRole("radio", { name: "Milo" })],
    ["MedidorPassword", MedidorDePrueba, () => screen.getByRole("button", { name: "escribir" })],
  ] as const)("%s", async (_n, Componente, tocar) => {
    await cambiarEstado(Componente, tocar);
    expect(avisos).toEqual([]);
  });
});

// Clases que obligan a remontar si se agregan o quitan después del primer render.
const QUE_REMONTAN =
  /^(-?(shadow|ring|translate|scale|rotate|skew|blur|drop-shadow|backdrop|transition|animate|duration|delay|ease|container|@container)\b|[\w-]+:)/;

describe("ninguna clase condicional de este tipo en el código", () => {
  it("shadow, ring, transform, transición, animación ni pseudo-clases en un className que depende del estado", () => {
    const problemas: string[] = [];
    for (const archivo of FUENTES) {
      const codigo = readFileSync(archivo, "utf8");
      for (const m of codigo.matchAll(/className=\{/g)) {
        // Expresión entre llaves balanceadas.
        let nivel = 0;
        let fin = m.index! + "className=".length;
        for (; fin < codigo.length; fin++) {
          if (codigo[fin] === "{") nivel++;
          else if (codigo[fin] === "}" && --nivel === 0) break;
        }
        const expresion = codigo.slice(m.index!, fin + 1);
        if (!/\?|&&|\|\|/.test(expresion)) continue; // sin condición
        const literales = (expresion.match(/"[^"]*"/g) ?? []).flatMap((l) => l.slice(1, -1).split(/\s+/));
        const malas = literales.filter((c) => QUE_REMONTAN.test(c));
        if (malas.length) {
          const linea = codigo.slice(0, m.index).split("\n").length;
          problemas.push(`${relative(RAIZ, archivo)}:${linea} ${malas.join(" ")}`);
        }
      }
    }
    expect(problemas).toEqual([]);
  });
});
