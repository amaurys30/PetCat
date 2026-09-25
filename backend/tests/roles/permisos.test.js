import { describe, expect, it } from "vitest";
import { pool } from "../../src/config/db.js";
import { authorize } from "../../src/shared/middlewares/authorize.middleware.js";
import {
  CATALOGO_PERMISOS,
  permisosSchema,
  permisosIncluidos,
} from "../../src/shared/utils/permissions.js";
import { api } from "../helpers/api.js";
import { crearUsuario, tokenDe } from "../helpers/factories.js";

describe("GET /permisos", () => {
  it("devuelve el catálogo a cualquier usuario autenticado", async () => {
    const res = await api(await tokenDe(await crearUsuario())).get("/permisos");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(CATALOGO_PERMISOS);
    expect(Object.keys(res.body.data)).toEqual(
      expect.arrayContaining(["citas", "configuracion", "historial_medico", "vacunas"])
    );
  });

  it("sin token -> 401", async () => {
    expect((await api().get("/permisos")).status).toBe(401);
  });
});

describe("catálogo de permisos", () => {
  it("permisosSchema acepta el catálogo, quita repetidos y módulos vacíos", () => {
    expect(permisosSchema.parse({ citas: ["ver", "ver", "crear"], roles: [] })).toEqual({
      citas: ["ver", "crear"],
    });
  });

  it("permisosSchema rechaza módulos y acciones desconocidos", () => {
    const moduloDesconocido = permisosSchema.safeParse({ horarios: ["ver"] });
    expect(moduloDesconocido.success).toBe(false);

    const accionDesconocida = permisosSchema.safeParse({ citas: ["borrar"] });
    expect(accionDesconocida.success).toBe(false);
    expect(accionDesconocida.error.issues[0].path).toEqual(["citas", 0]);
  });

  it("permisosIncluidos compara acción por acción", () => {
    const disponibles = { citas: ["ver", "crear"], clientes: ["ver"] };
    expect(permisosIncluidos({ citas: ["ver"] }, disponibles)).toBe(true);
    expect(permisosIncluidos({}, disponibles)).toBe(true);
    expect(permisosIncluidos({ citas: ["ver", "cancelar"] }, disponibles)).toBe(false);
    expect(permisosIncluidos({ roles: ["ver"] }, disponibles)).toBe(false);
  });

  it("authorize rechaza al definir la ruta un permiso fuera del catálogo", () => {
    expect(() => authorize("horarios", "crear")).toThrow(/CATALOGO_PERMISOS/);
    expect(() => authorize("citas", "ver")).not.toThrow();
  });

  it("los roles del sistema solo usan permisos del catálogo y el Administrador los tiene todos", async () => {
    const [roles] = await pool.query("SELECT nombre, permisos_json FROM roles WHERE es_sistema = TRUE");
    for (const rol of roles) {
      expect(permisosSchema.safeParse(rol.permisos_json).success, rol.nombre).toBe(true);
    }
    const admin = roles.find((r) => r.nombre === "Administrador");
    expect(permisosIncluidos(CATALOGO_PERMISOS, admin.permisos_json)).toBe(true);
  });
});
