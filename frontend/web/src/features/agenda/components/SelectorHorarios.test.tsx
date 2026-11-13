import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectorHorarios } from "./SelectorHorarios";

const horas = (...h: string[]) => h.map((hora_inicio) => ({ hora_inicio }));

describe("SelectorHorarios", () => {
  it("agrupa por mañana, tarde y noche (sin grupos vacíos) y elige la hora", async () => {
    const onElegir = vi.fn();
    render(
      <SelectorHorarios
        horarios={horas("08:00", "11:45", "12:00", "17:59", "18:00", "23:30")}
        elegido="12:00"
        onElegir={onElegir}
      />,
    );

    const grupo = screen.getByRole("radiogroup", { name: "Horarios libres" });
    const franjas = within(grupo).getAllByRole("group");
    expect(franjas.map((f) => f.getAttribute("aria-label"))).toEqual(["Mañana", "Tarde", "Noche"]);
    expect(within(franjas[0]!).getAllByRole("radio").map((r) => r.textContent)).toEqual(["08:00", "11:45"]);
    expect(within(franjas[1]!).getAllByRole("radio").map((r) => r.textContent)).toEqual(["12:00", "17:59"]);
    expect(within(franjas[2]!).getAllByRole("radio").map((r) => r.textContent)).toEqual(["18:00", "23:30"]);
    expect(screen.getByRole("radio", { name: "12:00" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("radio", { name: "18:00" }));
    expect(onElegir).toHaveBeenCalledWith("18:00");
  });

  it("solo tarde: no muestra mañana ni noche", () => {
    render(<SelectorHorarios horarios={horas("14:00", "15:00")} elegido={null} onElegir={() => undefined} />);
    expect(screen.getAllByRole("group").map((f) => f.getAttribute("aria-label"))).toEqual(["Tarde"]);
  });
});
