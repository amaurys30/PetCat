import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { __reiniciarSesionParaPruebas } from "@/api/sesion";
import { catalogoDemo, rolesDemo } from "@/test/equipo";
import { negocioDemo, renderRuta, usuarioDemo } from "@/test/render";
import { API, fallo, http, ok, servidor } from "@/test/servidor";

const base = () => [
  http.get(`${API}/negocios/1/roles`, () => ok(rolesDemo)),
  http.get(`${API}/permisos`, () => ok(catalogoDemo)),
  http.get(`${API}/auth/me`, () => ok(usuarioDemo())),
  http.get(`${API}/negocios/1/suscripcion`, () =>
    ok({ plan: { id_plan: 1, nombre: "Gratuito" }, suscripcion: null, prueba_disponible: true, uso: {} }),
  ),
];

beforeEach(() => __reiniciarSesionParaPruebas());

describe("D4 · Roles y permisos", () => {
  it("lista los roles con sus miembros activos e inactivos; los del sistema son de solo lectura", async () => {
    servidor.use(...base());
    renderRuta("/n/1/equipo/roles", { usuario: usuarioDemo() });
    const veterinario = await screen.findByRole("button", { name: /Veterinario/ });
    expect(veterinario).toHaveTextContent("2 activos · 1 inactivo");
    expect(screen.getByRole("button", { name: /Coordinador/ })).toHaveTextContent("Propio");

    // El primero (Administrador, del sistema) queda elegido: casillas deshabilitadas.
    expect(screen.getByRole("heading", { name: 'Permisos del rol "Administrador"' })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Citas: ver" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Citas: ver" })).toBeChecked();
    expect(screen.getByText(/Los roles del sistema no se pueden editar\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    // Acciones que no están en las columnas fijas van en "otras acciones".
    expect(screen.getByRole("checkbox", { name: "Pagos: ver básico" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Citas: ver citas de todos" })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Historial médico: registrar a nombre de otro profesional" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Reseñas: responder" })).toBeInTheDocument();
  });

  it("edita un rol propio y envía solo lo que cambió", async () => {
    let cuerpo: unknown;
    servidor.use(
      ...base(),
      http.patch(`${API}/roles/9`, async ({ request }) => {
        cuerpo = await request.json();
        return ok(rolesDemo[3]);
      }),
    );
    renderRuta("/n/1/equipo/roles?rol=9", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "Clientes: editar" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() =>
      expect(cuerpo).toEqual({
        permisos_json: {
          citas: ["crear", "ver"],
          clientes: ["editar", "ver"],
          empleados: ["crear", "editar", "eliminar", "ver"],
          roles: ["ver"],
        },
      }),
    );
  });

  it("no deja eliminar un rol con miembros (dice cuántos) y muestra el 409 de la API", async () => {
    const sinMiembros = { ...rolesDemo[3]!, id_rol: 10, nombre: "Auxiliar", empleados_activos: 0 };
    servidor.use(
      // Antes que base(): entre las respuestas de una misma llamada gana la primera.
      http.get(`${API}/negocios/1/roles`, () => ok([...rolesDemo, sinMiembros])),
      ...base(),
      http.delete(`${API}/roles/10`, () =>
        fallo(
          409,
          "Hay 1 empleado inactivo con este rol: cámbiales el rol antes de eliminarlo, también a los inactivos",
        ),
      ),
    );
    const { router } = renderRuta("/n/1/equipo/roles?rol=9", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    expect(await screen.findByRole("button", { name: "Eliminar rol" })).toBeDisabled();

    await router.navigate("/n/1/equipo/roles?rol=10");
    await screen.findByRole("heading", { name: 'Permisos del rol "Auxiliar"' });
    await user.click(screen.getByRole("button", { name: "Eliminar rol" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Eliminar rol" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("también a los inactivos");
  });

  it("crea un rol propio desde ?rol=nuevo", async () => {
    let cuerpo: unknown;
    servidor.use(
      ...base(),
      http.post(`${API}/negocios/1/roles`, async ({ request }) => {
        cuerpo = await request.json();
        return ok({ ...rolesDemo[3], id_rol: 11, nombre: "Estilista" }, 201);
      }),
    );
    const { router } = renderRuta("/n/1/equipo/roles?rol=nuevo", { usuario: usuarioDemo() });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nombre *"), "Estilista");
    await user.type(screen.getByLabelText("Descripción"), "Solo sus citas de peluquería");
    await user.click(screen.getByRole("checkbox", { name: "Citas: ver" }));
    await user.click(screen.getByRole("button", { name: "Crear rol" }));
    await waitFor(() => expect(router.state.location.search).toBe("?rol=11"));
    expect(cuerpo).toEqual({
      nombre: "Estilista",
      descripcion: "Solo sus citas de peluquería",
      permisos_json: { citas: ["ver"] },
    });
  });

  it("escalada: un empleado no edita su propio rol ni otorga permisos que no tiene", async () => {
    const coordinador = usuarioDemo({
      negocios: [
        negocioDemo({
          relacion: "empleado",
          id_empleado: 6,
          rol: {
            id_rol: 12,
            nombre: "Jefe de equipo",
            permisos_json: { roles: ["ver", "crear", "editar"], empleados: ["ver"], citas: ["ver"] },
          },
        }),
      ],
    });
    const jefe = {
      ...rolesDemo[3]!,
      id_rol: 12,
      nombre: "Jefe de equipo",
      permisos_json: { roles: ["ver", "crear", "editar"], empleados: ["ver"], citas: ["ver"] },
    };
    servidor.use(
      http.get(`${API}/negocios/1/roles`, () => ok([...rolesDemo, jefe])),
      http.get(`${API}/permisos`, () => ok(catalogoDemo)),
    );
    const { router } = renderRuta("/n/1/equipo/roles?rol=12", { usuario: coordinador });
    expect(await screen.findByText(/No puedes modificar tu propio rol\./)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Citas: ver" })).toBeDisabled();

    // El Coordinador tiene permisos que el Jefe de equipo no tiene: solo lectura.
    await router.navigate("/n/1/equipo/roles?rol=9");
    expect(await screen.findByText(/Este rol tiene permisos que tu rol no tiene\./)).toBeInTheDocument();

    // En un rol nuevo solo puede marcar lo que su rol tiene.
    await router.navigate("/n/1/equipo/roles?rol=nuevo");
    await screen.findByRole("heading", { name: "Nuevo rol" });
    expect(screen.getByRole("checkbox", { name: "Citas: ver" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Citas: crear" })).toBeDisabled();
    expect(screen.getByText(/Solo puedes otorgar permisos que tu propio rol tiene\./)).toBeInTheDocument();
  });

  it("sin roles.ver no aparece la pestaña", async () => {
    const recepcion = usuarioDemo({
      negocios: [
        negocioDemo({
          relacion: "empleado",
          id_empleado: 3,
          rol: { id_rol: 3, nombre: "Recepcionista", permisos_json: { empleados: ["ver"] } },
        }),
      ],
    });
    servidor.use(http.get(`${API}/negocios/1/empleados`, () => ok([])));
    renderRuta("/n/1/equipo/roles", { usuario: recepcion });
    expect(await screen.findByText("No tienes permiso para ver esta sección")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Roles y permisos" })).not.toBeInTheDocument();
  });
});
