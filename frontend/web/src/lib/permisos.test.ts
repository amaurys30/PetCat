import { describe, expect, it } from "vitest";
import { MOTIVOS_ESCALADA, permisosIncluidos, puede, reglasEscalada } from "./permisos";

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

describe("permisosIncluidos", () => {
  it("cada acción debe estar en los disponibles; un rol vacío siempre cabe", () => {
    const mios = { citas: ["ver", "crear"], clientes: ["ver"] };
    expect(permisosIncluidos({ citas: ["ver"] }, mios)).toBe(true);
    expect(permisosIncluidos({}, mios)).toBe(true);
    expect(permisosIncluidos({ citas: ["ver", "cancelar"] }, mios)).toBe(false);
    expect(permisosIncluidos({ reportes: ["ver"] }, mios)).toBe(false);
  });
});

describe("reglasEscalada", () => {
  const coordinador = {
    relacion: "empleado" as const,
    id_empleado: 7,
    rol: {
      id_rol: 9,
      nombre: "Coordinador",
      permisos_json: { empleados: ["ver", "crear", "editar"], citas: ["ver"] },
    },
  };
  const admin = { empleados: ["ver", "crear", "editar", "eliminar"], citas: ["ver"] };

  it("a un empleado le bloquea roles y empleados con más permisos, su rol y desactivarse", () => {
    const r = reglasEscalada(cliente, coordinador);
    expect(r.asignarRol({ citas: ["ver"] })).toBeNull();
    expect(r.asignarRol(admin)).toBe(MOTIVOS_ESCALADA.rolAjeno);
    expect(r.modificarEmpleado(3, admin)).toBe(MOTIVOS_ESCALADA.empleadoConMas);
    expect(r.modificarEmpleado(3, { citas: ["ver"] })).toBeNull();
    // Sus propios datos sí, aunque su rol no cambie.
    expect(r.modificarEmpleado(7, admin)).toBeNull();
    expect(r.cambiarRolDe(7)).toBe(MOTIVOS_ESCALADA.propioRol);
    expect(r.desactivar(7)).toBe(MOTIVOS_ESCALADA.desactivarse);
    expect(r.modificarRol({ id_rol: 9, permisos_json: {} })).toBe(MOTIVOS_ESCALADA.modificarPropioRol);
    expect(r.modificarRol({ id_rol: 1, permisos_json: admin })).toBe(MOTIVOS_ESCALADA.rolConMas);
    expect(r.otorgar("citas", "ver")).toBeNull();
    expect(r.otorgar("citas", "cancelar")).toBe(MOTIVOS_ESCALADA.permisoAjeno);
    // Sin los permisos del empleado (no se pudieron consultar), decide la API.
    expect(r.modificarEmpleado(3, undefined)).toBeNull();
  });

  it("el propietario y el admin de la plataforma no tienen límite", () => {
    for (const r of [
      reglasEscalada(cliente, { relacion: "propietario", rol: null, id_empleado: 4 }),
      reglasEscalada({ tipo_usuario: "admin" }, coordinador),
    ]) {
      expect(r.asignarRol(admin)).toBeNull();
      expect(r.modificarEmpleado(3, admin)).toBeNull();
      expect(r.cambiarRolDe(4)).toBeNull();
      expect(r.desactivar(4)).toBeNull();
      expect(r.otorgar("reportes", "exportar")).toBeNull();
    }
  });
});
