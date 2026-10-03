import { describe, expect, it } from "vitest";
import { puede } from "./permisos";

const cliente = { tipo_usuario: "cliente" as const };
const propietario = { relacion: "propietario" as const, rol: null };
const veterinario = {
  relacion: "empleado" as const,
  rol: { id_rol: 2, nombre: "Veterinario", permisos_json: { citas: ["ver", "editar"], vacunas: ["ver"] } },
};

describe("puede", () => {
  it("el propietario puede todo", () => {
    expect(puede(cliente, propietario, "empleados", "eliminar")).toBe(true);
  });

  it("el empleado solo lo que trae su rol", () => {
    expect(puede(cliente, veterinario, "citas", "editar")).toBe(true);
    expect(puede(cliente, veterinario, "citas", "cancelar")).toBe(false);
    expect(puede(cliente, veterinario, "reportes", "ver")).toBe(false);
  });

  it("sin negocio no puede nada, salvo el admin de la plataforma", () => {
    expect(puede(cliente, null, "citas", "ver")).toBe(false);
    expect(puede({ tipo_usuario: "admin" }, null, "citas", "ver")).toBe(true);
  });

  it("un rol sin permisos no rompe", () => {
    const sinPermisos = {
      relacion: "empleado" as const,
      rol: { id_rol: 9, nombre: "Nuevo", permisos_json: {} },
    };
    expect(puede(cliente, sinPermisos, "citas", "ver")).toBe(false);
  });
});
