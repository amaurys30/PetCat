import { fireEvent, render, screen } from "@testing-library/react-native";
import { Inbox } from "lucide-react-native";
import { useState } from "react";

import { ApiError, MENSAJES } from "@/api/errors";

import { renderConProveedores } from "../../../test/render";

import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  iniciales,
  Input,
  ScreenHeader,
  Segmented,
  SkeletonLista,
  Text,
  Toggle,
} from "./index";

describe("Text", () => {
  it("los títulos se anuncian como encabezado", async () => {
    await render(<Text variante="titulo">Mis mascotas</Text>);
    expect(screen.getByRole("header", { name: "Mis mascotas" })).toBeOnTheScreen();
  });

  it("el cuerpo no es encabezado", async () => {
    await render(<Text>Hola</Text>);
    expect(screen.queryByRole("header")).toBeNull();
  });
});

describe("Button", () => {
  it.each(["primario", "secundario", "suave", "peligro"] as const)(
    "%s: botón con etiqueta que responde",
    async (variante) => {
      const onPress = jest.fn();
      await render(<Button titulo="Guardar" variante={variante} onPress={onPress} />);
      await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));
      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );

  it("deshabilitado: lo anuncia y no responde", async () => {
    const onPress = jest.fn();
    await render(<Button titulo="Guardar" disabled onPress={onPress} />);
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton).toBeDisabled();
    await fireEvent.press(boton);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("cargando: ocupado y sin responder", async () => {
    const onPress = jest.fn();
    await render(<Button titulo="Guardar" cargando onPress={onPress} />);
    const boton = screen.getByRole("button", { name: "Guardar" });
    expect(boton).toBeBusy();
    await fireEvent.press(boton);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("Chip", () => {
  it("como filtro anuncia si está seleccionado", async () => {
    const onPress = jest.fn();
    await render(<Chip etiqueta="Perros" seleccionado onPress={onPress} />);
    const chip = screen.getByRole("button", { name: "Perros" });
    expect(chip).toBeSelected();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
  });

  it("sin onPress es informativo (no es botón)", async () => {
    await render(<Chip etiqueta="Vacuna al día" />);
    expect(screen.getByText("Vacuna al día")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Card", () => {
  it("presionable con etiqueta", async () => {
    const onPress = jest.fn();
    await render(
      <Card onPress={onPress} accessibilityLabel="Ver a Max">
        <Text>Max</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Ver a Max" }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("el campo tiene la etiqueta y recibe texto", async () => {
    const onChangeText = jest.fn();
    await render(<Input etiqueta="Correo" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText("Correo"), "sofia@petcat.test");
    expect(onChangeText).toHaveBeenCalledWith("sofia@petcat.test");
  });

  it("anuncia el error con el campo y lo muestra", async () => {
    await render(<Input etiqueta="Correo" error="Escribe un correo válido" />);
    expect(screen.getByLabelText("Correo. Error: Escribe un correo válido")).toBeOnTheScreen();
    expect(screen.getByText("Escribe un correo válido")).toBeOnTheScreen();
  });
});

describe("Segmented", () => {
  function Prueba() {
    const [valor, setValor] = useState<"proximas" | "pasadas">("proximas");
    return (
      <Segmented
        etiqueta="Ver citas"
        valor={valor}
        onCambiar={setValor}
        opciones={[
          { valor: "proximas", etiqueta: "Próximas" },
          { valor: "pasadas", etiqueta: "Pasadas" },
        ]}
      />
    );
  }

  it("anuncia la opción activa y cambia al tocar otra", async () => {
    await render(<Prueba />);
    // El grupo no es "accessible" (agruparía las opciones en un solo elemento): se busca por etiqueta.
    expect(screen.getByLabelText("Ver citas")).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByRole("radio", { name: "Próximas" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Pasadas" })).not.toBeChecked();

    await fireEvent.press(screen.getByRole("radio", { name: "Pasadas" }));
    expect(screen.getByRole("radio", { name: "Pasadas" })).toBeChecked();
  });
});

describe("Toggle", () => {
  function Prueba() {
    const [activo, setActivo] = useState(false);
    return <Toggle etiqueta="Recordatorios" activo={activo} onCambiar={setActivo} />;
  }

  it("anuncia su estado y cambia", async () => {
    await render(<Prueba />);
    const interruptor = screen.getByRole("switch", { name: "Recordatorios" });
    expect(interruptor).not.toBeChecked();
    await fireEvent.press(interruptor);
    expect(screen.getByRole("switch", { name: "Recordatorios" })).toBeChecked();
  });
});

describe("Avatar", () => {
  it("iniciales con la etiqueta del nombre", async () => {
    await render(<Avatar nombre="Sofía Gómez" />);
    expect(screen.getByRole("image", { name: "Sofía Gómez" })).toBeOnTheScreen();
    expect(iniciales("sofía de la Gómez")).toBe("SD");
  });

  it("con foto se anuncia como foto", async () => {
    await render(<Avatar nombre="Max" uri="https://res.cloudinary.com/x.jpg" />);
    expect(screen.getByRole("image", { name: "Foto de Max" })).toBeOnTheScreen();
  });

  it("mascota sin foto: ilustración por especie", async () => {
    await render(<Avatar nombre="Luna" especie="gato" />);
    expect(screen.getByRole("image", { name: "Luna" })).toBeOnTheScreen();
  });
});

describe("ScreenHeader", () => {
  // La flecha Volver (con su ruta de respaldo) se prueba con el router en features/navegacion.test.tsx.
  it("título como encabezado; sin volverA no hay flecha", async () => {
    await renderConProveedores(<ScreenHeader titulo="Ficha" subtitulo="Max" />);
    expect(screen.getByRole("header", { name: "Ficha" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
  });
});

describe("EmptyState y ErrorState", () => {
  it("vacío con acción", async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        icono={Inbox}
        titulo="Aún no tienes mascotas"
        accion={{ etiqueta: "Agregar mascota", onPress }}
      />,
    );
    expect(screen.getByRole("header", { name: "Aún no tienes mascotas" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Agregar mascota" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("error de red con reintento", async () => {
    const onReintentar = jest.fn();
    await render(<ErrorState error={new ApiError(0, MENSAJES.red, "red")} onReintentar={onReintentar} />);
    expect(screen.getByRole("header", { name: "Sin conexión" })).toBeOnTheScreen();
    expect(screen.getByText(MENSAJES.red)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(onReintentar).toHaveBeenCalled();
  });

  it("un error desconocido no muestra su detalle", async () => {
    await render(<ErrorState error={new Error("TypeError: undefined is not a function")} />);
    expect(screen.getByText(MENSAJES.generico)).toBeOnTheScreen();
    expect(screen.queryByText(/TypeError/)).toBeNull();
  });
});

describe("Skeleton", () => {
  it("se anuncia una sola vez como cargando", async () => {
    await render(<SkeletonLista filas={3} />);
    expect(screen.getByRole("progressbar", { name: "Cargando" })).toBeOnTheScreen();
  });
});
