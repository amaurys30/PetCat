import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { http, HttpResponse } from "msw";
import { AccessibilityInfo, Alert, type AlertButton, Linking } from "react-native";

import { refreshStorage } from "@/api/refreshStorage";
import { guardarSesionSinConexion, suscribirCache } from "@/lib/cachePersistente";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { useMascotaSeleccionada } from "@/store/mascotaSeleccionada";
import { useSesion } from "@/store/sesion";

import { reiniciarSesion, renderApp } from "../../../test/app";
import { API, fallo, mascotaDemo, ok, perfilDemo, sesionDemo } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";

let anuncios: string[];

beforeEach(async () => {
  await reiniciarSesion();
  anuncios = [];
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((m) => void anuncios.push(m));
});

afterEach(() => jest.restoreAllMocks());

const luna = mascotaDemo();
const milo = mascotaDemo({
  id_mascota: 2,
  nombre: "Milo",
  especie: "gato",
  raza: null,
  sexo: "macho",
  peso: 4.2,
  edad_meses: 14,
  resumen: {
    estado_vacunas: "proximo",
    vacunas: { vigentes: 2, al_dia: 1, proximas: 1, vencidas: 0 },
    proximos_eventos: [
      {
        tipo: "vacuna",
        titulo: "Triple felina",
        fecha: "2026-11-29",
        dias: 10,
        id_vacuna: 3,
        id_historial: null,
        negocio: null,
      },
    ],
    proxima_cita: {
      id_cita: 9,
      fecha: "2026-11-25",
      hora_inicio: "08:30",
      estado: "confirmada",
      servicio: { id_servicio: 1, nombre: "Consulta general" },
      negocio: { id_negocio: 1, nombre: "Clínica Patitas" },
    },
  },
});

/** Sesión guardada que el arranque renueva, y las mascotas de la cuenta. */
function conSesion(mascotas: unknown[] = [luna, milo]) {
  void refreshStorage.guardar("refresh-0");
  server.use(
    http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(1))),
    http.get(`${API}/auth/me`, () => ok(perfilDemo())),
    http.get(`${API}/mascotas`, () => ok(mascotas)),
    http.get(`${API}/mascotas/:id`, ({ params }) => {
      const m = (mascotas as { id_mascota: number }[]).find((x) => x.id_mascota === Number(params.id));
      return m ? ok(m) : fallo(404, "Mascota no encontrada");
    }),
  );
}

/** Responde a un Alert.alert tocando el botón con ese texto. */
function responderAlerta(texto: string) {
  return jest.spyOn(Alert, "alert").mockImplementation((_t, _m, botones?: AlertButton[]) => {
    botones?.find((b) => b.text === texto)?.onPress?.();
  });
}

const escribir = (etiqueta: string | RegExp, texto: string) =>
  fireEvent.changeText(screen.getByLabelText(etiqueta), texto);

describe("M4 · Inicio", () => {
  it("sin mascotas: invita a agregar la primera", async () => {
    conSesion([]);
    await renderApp("/");
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar mascota" }));
    expect(screen).toHavePathname("/mascotas/nueva");
  });

  it("muestra la mascota guardada, cambia con el selector y recuerda la elección", async () => {
    conSesion();
    await renderApp("/");

    expect(await screen.findByRole("header", { name: "Sofía" })).toBeOnTheScreen();
    expect(await screen.findByRole("radio", { name: "Luna" })).toBeChecked();
    expect(screen.getByText("Luna no tiene citas próximas.")).toBeOnTheScreen();
    expect(screen.queryByText("Recordatorios")).toBeNull();

    await fireEvent.press(screen.getByRole("radio", { name: "Milo" }));

    expect(screen.getByRole("radio", { name: "Milo" })).toBeChecked();
    expect(screen.getByLabelText(/Consulta general/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Vacuna: Triple felina. En 10 días, dom 29 nov.")).toBeOnTheScreen();
    expect(useMascotaSeleccionada.getState()).toMatchObject({ id_usuario: 7, id_mascota: 2 });
  });

  it("si la mascota guardada ya no está, muestra la primera viva", async () => {
    useMascotaSeleccionada.setState({ id_usuario: 7, id_mascota: 99 });
    conSesion([mascotaDemo({ id_mascota: 5, nombre: "Rex", fallecido: true }), milo]);
    await renderApp("/");
    expect(await screen.findByRole("radio", { name: "Milo" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Rex" })).toBeNull();
  });

  it("el Pasaporte abre la pestaña Carnet con esa mascota", async () => {
    conSesion();
    await renderApp("/");
    await fireEvent.press(await screen.findByRole("button", { name: "Abrir el Pasaporte PetCat de Luna" }));
    expect(screen).toHavePathname("/carnet");
    expect(await screen.findByText(/Pasaporte PetCat de Luna/)).toBeOnTheScreen();
  });

  it("si la API falla: error con Reintentar", async () => {
    conSesion();
    server.use(http.get(`${API}/mascotas`, () => fallo(500, "Error interno")));
    await renderApp("/");
    expect(await screen.findByRole("button", { name: "Intentar de nuevo" })).toBeOnTheScreen();

    server.use(http.get(`${API}/mascotas`, () => ok([luna])));
    await fireEvent.press(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(await screen.findByRole("radio", { name: "Luna" })).toBeOnTheScreen();
  });
});

describe("M5 · Mis mascotas y M6 · Ficha", () => {
  it("tarjetas con una sola etiqueta; las que están en memoria van al final", async () => {
    conSesion([
      mascotaDemo({
        id_mascota: 5,
        nombre: "Rex",
        fallecido: true,
        resumen: { ...luna.resumen, estado_vacunas: null },
      }),
      luna,
    ]);
    await renderApp("/mascotas");

    const tarjetas = await screen.findAllByRole("button", { name: /Ver ficha\.$/ });
    expect(tarjetas.map((t) => t.props.accessibilityLabel)).toEqual([
      "Luna, Perro · Labrador · Hembra · 3 años. Sin vacunas registradas. Ver ficha.",
      expect.stringContaining("Rex, Perro · Labrador · Hembra · 3 años. En memoria."),
    ]);

    await fireEvent.press(tarjetas[0]!);
    expect(screen).toHavePathname("/mascotas/1");
  });

  it("la ficha describe el peso en texto y muestra los datos clave", async () => {
    conSesion();
    server.use(
      http.get(`${API}/mascotas/1/pesos`, () =>
        ok({
          peso_actual: 28.4,
          puntos: [
            { fecha: "2026-08-12", peso: 27.8, origen: "historial" },
            { fecha: "2026-11-12", peso: 28.4, origen: "dueno" },
          ],
        }),
      ),
    );
    await renderApp("/mascotas/1");

    expect(
      await screen.findByLabelText(
        "Peso. Subió 0,6 kg en 3 meses, de 27,8 a 28,4 kg. Último registro: jue 12 nov.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Esterilizada: Sí")).toBeOnTheScreen();
    expect(screen.getByLabelText("Edad: 3 años")).toBeOnTheScreen();
  });

  it("si el peso falla, el error queda solo en su tarjeta", async () => {
    conSesion();
    server.use(http.get(`${API}/mascotas/1/pesos`, () => fallo(500, "Error interno")));
    await renderApp("/mascotas/1");
    expect(await screen.findByText("No pudimos cargar el peso")).toBeOnTheScreen();
    expect(screen.getByLabelText("Microchip: Sin registrar")).toBeOnTheScreen();
  });
});

describe("M21 · Nueva mascota", () => {
  it("valida el paso 1 sin llamar a la API", async () => {
    conSesion([]);
    await renderApp("/mascotas/nueva");

    await fireEvent.press(await screen.findByRole("button", { name: "Continuar" }));

    expect(await screen.findByLabelText("Nombre. Error: Escribe su nombre")).toBeOnTheScreen();
    expect(screen.getByLabelText("¿Qué es? Error: Elige qué animal es")).toBeOnTheScreen();
    expect(anuncios).toContain("Revisa 2 campos del formulario");
  });

  it("Otro muestra más animales; crea la mascota, sube la foto comprimida y abre la ficha", async () => {
    conSesion([]);
    const cuerpos: unknown[] = [];
    let foto: unknown = null;
    const creada = mascotaDemo({
      id_mascota: 30,
      nombre: "Copito",
      especie: "conejo",
      raza: null,
      sexo: "desconocido",
    });
    server.use(
      http.post(`${API}/mascotas`, async ({ request }) => {
        cuerpos.push(await request.json());
        return HttpResponse.json({ success: true, message: "Mascota creada", data: creada }, { status: 201 });
      }),
      http.put(`${API}/mascotas/30/foto`, async ({ request }) => {
        foto = await request.formData();
        return ok({ ...creada, foto_url: "https://img.test/copito.jpg" });
      }),
      http.get(`${API}/mascotas/30`, () => ok(creada)),
    );
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///original.heic", width: 4000, height: 3000 } as ImagePicker.ImagePickerAsset],
    });
    await renderApp("/mascotas/nueva");

    await fireEvent.press(await screen.findByRole("radio", { name: "Otro" }));
    expect(anuncios).toContain("Elige qué animal es: conejo, ave, reptil, roedor, pez u otro");
    expect(screen.getByLabelText("¿Qué animal es?")).toBeOnTheScreen();
    await escribir("Nombre", "Copito");
    await fireEvent.press(screen.getByRole("button", { name: "Elegir de la galería" }));
    expect(await screen.findByLabelText("Foto de Copito")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await escribir("Peso en kilos (opcional)", "2,5");
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar mascota" }));

    await waitFor(() => expect(screen).toHavePathname("/mascotas/30"));
    expect(cuerpos[0]).toEqual({
      nombre: "Copito",
      especie: "conejo",
      sexo: "desconocido",
      esterilizado: false,
      tiene_alergias: false,
      compartir_historial: true,
      peso: 2.5,
    });
    expect(foto).not.toBeNull();
    expect(useMascotaSeleccionada.getState().id_mascota).toBe(30);
  });

  it("si la foto falla, la mascota queda guardada: reintentar o seguir sin foto", async () => {
    conSesion([]);
    let intentos = 0;
    const creada = mascotaDemo({ id_mascota: 31, nombre: "Toby" });
    server.use(
      http.post(`${API}/mascotas`, () =>
        HttpResponse.json({ success: true, message: "OK", data: creada }, { status: 201 }),
      ),
      http.put(`${API}/mascotas/31/foto`, () =>
        ++intentos === 1 ? fallo(500, "Error interno") : ok(creada),
      ),
      http.get(`${API}/mascotas/31`, () => ok(creada)),
    );
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///a.jpg", width: 800, height: 800 } as ImagePicker.ImagePickerAsset],
    });
    await renderApp("/mascotas/nueva");
    await fireEvent.press(await screen.findByRole("radio", { name: "Perro" }));
    await escribir("Nombre", "Toby");
    await fireEvent.press(screen.getByRole("button", { name: "Elegir de la galería" }));
    await screen.findByLabelText("Foto de Toby");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar mascota" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Toby quedó guardada, pero la foto no se pudo subir/,
    );
    expect(anuncios).toContain("Toby quedó guardada, pero la foto no se pudo subir");

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar subir la foto" }));
    await waitFor(() => expect(screen).toHavePathname("/mascotas/31"));
    expect(intentos).toBe(2);
  });

  it("un 422 del nombre vuelve al paso 1 con el error en el campo", async () => {
    conSesion([]);
    server.use(
      http.post(`${API}/mascotas`, () => fallo(422, "Datos inválidos", { nombre: "Nombre no permitido" })),
    );
    await renderApp("/mascotas/nueva");
    await fireEvent.press(await screen.findByRole("radio", { name: "Gato" }));
    await escribir("Nombre", "Michi");
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar mascota" }));

    expect(await screen.findByLabelText("Nombre. Error: Nombre no permitido")).toBeOnTheScreen();
    expect(screen.getByText("Paso 1 de 2")).toBeOnTheScreen();
  });

  it("la cámara: explica antes del permiso; si está bloqueada, ofrece Ajustes", async () => {
    conSesion([]);
    jest.spyOn(Linking, "openSettings").mockResolvedValue();
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    } as ImagePicker.CameraPermissionResponse);
    await renderApp("/mascotas/nueva");

    await fireEvent.press(await screen.findByRole("button", { name: "Tomar foto" }));
    expect(screen.getByText(/usará la cámara solo para tomar la foto de tu mascota/)).toBeOnTheScreen();
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Usar la cámara" }));
    expect(await screen.findByText(/La cámara está desactivada para PetCat/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Abrir Ajustes" }));
    expect(Linking.openSettings).toHaveBeenCalled();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });
});

describe("Editar, eliminar y fallecimiento", () => {
  it("guardar envía solo lo que cambió", async () => {
    conSesion();
    const cuerpos: unknown[] = [];
    server.use(
      http.patch(`${API}/mascotas/1`, async ({ request }) => {
        cuerpos.push(await request.json());
        return ok({ ...luna, peso: 29 });
      }),
    );
    await renderApp("/mascotas/1/editar");

    await screen.findByLabelText("Peso en kilos (opcional)");
    await escribir("Peso en kilos (opcional)", "29");
    await escribir("Raza (opcional)", "");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(cuerpos).toEqual([{ peso: 29, raza: null }]));
    await waitFor(() => expect(anuncios).toContain("Cambios guardados"));
  });

  it("eliminar pide confirmación; con citas activas muestra el 409", async () => {
    conSesion();
    server.use(
      http.delete(`${API}/mascotas/1`, () =>
        fallo(409, "La mascota tiene citas pendientes o confirmadas. Cancélalas antes de eliminarla."),
      ),
    );
    const alerta = responderAlerta("Eliminar");
    await renderApp("/mascotas/1/editar");

    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar a Luna" }));

    expect(alerta).toHaveBeenCalledWith("Eliminar a Luna", expect.any(String), expect.any(Array));
    expect(await screen.findByRole("alert")).toHaveTextContent(/tiene citas pendientes o confirmadas/);
    expect(screen).toHavePathname("/mascotas/1/editar");
  });

  it("eliminar confirmado vuelve a Mis mascotas", async () => {
    conSesion();
    server.use(http.delete(`${API}/mascotas/1`, () => ok(null, "Mascota eliminada")));
    responderAlerta("Eliminar");
    await renderApp("/mascotas/1/editar");
    await fireEvent.press(await screen.findByRole("button", { name: "Eliminar a Luna" }));
    await waitFor(() => expect(screen).toHavePathname("/mascotas"));
  });

  it("registrar el fallecimiento: textos cuidadosos, fecha validada y confirmación", async () => {
    conSesion();
    const cuerpos: unknown[] = [];
    server.use(
      http.patch(`${API}/mascotas/1`, async ({ request }) => {
        cuerpos.push(await request.json());
        return ok({ ...luna, fallecido: true, fecha_fallecimiento: "2026-11-10" });
      }),
    );
    const alerta = responderAlerta("Registrar");
    await renderApp("/mascotas/1/editar");
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar fallecimiento" }));

    expect(await screen.findByText("Lamentamos mucho tu pérdida.")).toBeOnTheScreen();
    expect(screen.getByText("Si registras que Luna ha fallecido:")).toBeOnTheScreen();
    expect(screen.getByText(/Dejarás de recibir recordatorios/)).toBeOnTheScreen();

    await escribir(/^Fecha(. Error|$)/, "01012999");
    await fireEvent.press(screen.getAllByRole("button", { name: "Registrar fallecimiento" }).at(-1)!);
    expect(await screen.findByLabelText("Fecha. Error: No puede ser una fecha futura")).toBeOnTheScreen();
    expect(alerta).not.toHaveBeenCalled();

    await escribir(/^Fecha(. Error|$)/, "01012020");
    await fireEvent.press(screen.getAllByRole("button", { name: "Registrar fallecimiento" }).at(-1)!);
    expect(
      await screen.findByLabelText("Fecha. Error: No puede ser anterior a su nacimiento"),
    ).toBeOnTheScreen();

    await escribir(/^Fecha(. Error|$)/, "10112026");
    await fireEvent.press(screen.getAllByRole("button", { name: "Registrar fallecimiento" }).at(-1)!);

    expect(alerta).toHaveBeenCalledWith(
      "Confirmar",
      "¿Registrar que Luna falleció el mar 10 nov 2026?",
      expect.any(Array),
    );
    await waitFor(() => expect(cuerpos).toEqual([{ fallecido: true, fecha_fallecimiento: "2026-11-10" }]));
    await waitFor(() => expect(screen).toHavePathname("/mascotas/1"));
  });
});

describe("Sin conexión con datos guardados", () => {
  it("con red guarda en el teléfono la caché de mascotas y, del usuario, solo nombre e id", async () => {
    conSesion([luna]);
    await renderApp("/");
    await screen.findByRole("radio", { name: "Luna" });
    await waitFor(async () => expect(await AsyncStorage.getItem("petcat.cache")).toContain("Luna"));
    const guardada = JSON.parse((await AsyncStorage.getItem("petcat.sesion_sin_conexion"))!);
    expect(guardada).toEqual({ id_usuario: 7, nombre: "Sofía", guardado_en: expect.any(Number) });
    expect(await AsyncStorage.getItem("petcat.cache")).not.toContain("sofia@petcat.test");
  });

  it("sin red abre con los datos guardados, sin escribir; Reintentar entra al volver la red", async () => {
    // Lo que dejó la última apertura con red (menos de 24 h).
    await guardarSesionSinConexion(7, "Sofía");
    const dejar = suscribirCache(7);
    queryClient.setQueryData(queryKeys.mascotas.lista(), [luna]);
    await waitFor(async () => expect(await AsyncStorage.getItem("petcat.cache")).toContain("Luna"));
    dejar();
    queryClient.clear();

    await refreshStorage.guardar("refresh-0");
    server.use(
      http.post(`${API}/auth/refresh-token`, () => HttpResponse.error()),
      http.get(`${API}/mascotas`, () => HttpResponse.error()),
      http.get(`${API}/mascotas/:id`, () => HttpResponse.error()),
      http.get(`${API}/mascotas/:id/pesos`, () => HttpResponse.error()),
    );
    await renderApp("/");

    expect(await screen.findByText(/Sin conexión · datos de/)).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Luna" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Agregar mascota" })).toBeNull();

    await fireEvent.press(screen.getByLabelText("Ver todas mis mascotas"));
    await fireEvent.press(await screen.findByRole("button", { name: /^Luna, / }));
    expect(screen.queryByRole("button", { name: "Agregar otra mascota" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Editar (necesita conexión)" })).toBeDisabled();

    // Vuelve la red.
    server.use(
      http.post(`${API}/auth/refresh-token`, () => ok(sesionDemo(2))),
      http.get(`${API}/auth/me`, () => ok(perfilDemo())),
      http.get(`${API}/mascotas`, () => ok([luna])),
      http.get(`${API}/mascotas/1`, () => ok(luna)),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Editar a Luna" })).toBeEnabled();
    expect(useSesion.getState().modoSinConexion).toBe(false);
  }, 20_000);

  it("cerrar sesión borra la caché, la sesión guardada y la mascota elegida", async () => {
    conSesion([luna]);
    server.use(http.post(`${API}/auth/logout`, () => ok(null)));
    await renderApp("/");
    await screen.findByRole("radio", { name: "Luna" });
    await waitFor(async () => expect(await AsyncStorage.getItem("petcat.cache")).not.toBeNull());

    await fireEvent.press(screen.getByRole("tab", { name: "Perfil" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Cerrar sesión" }));

    await screen.findByTestId("carrusel-bienvenida", {}, { timeout: 15_000 });
    expect(await AsyncStorage.getItem("petcat.cache")).toBeNull();
    expect(await AsyncStorage.getItem("petcat.sesion_sin_conexion")).toBeNull();
    expect(useMascotaSeleccionada.getState().id_mascota).toBeNull();
  }, 30_000);
});
