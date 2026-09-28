import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { pool } from "../../src/config/db.js";
import { limpiarSesiones } from "../../src/modules/sessions/session.service.js";
import { crearDispositivo, crearUsuario } from "../helpers/factories.js";

/** Job de limpieza de sesiones y tokens de correo (2.4). */

const hash = () => randomBytes(32).toString("hex");

/** Sesión del usuario que vence (o venció) dentro de `dias` días. */
const sesion = async (usuario, dias, activa = true) => {
  const [result] = await pool.query(
    "INSERT INTO sesiones (id_usuario, token, refresh_token, activa, expira_en) VALUES (?, ?, ?, ?, NOW() + INTERVAL ? DAY)",
    [usuario.id_usuario, hash(), hash(), activa, dias]
  );
  return result.insertId;
};
const existe = async (id_sesion) => {
  const [rows] = await pool.query("SELECT 1 FROM sesiones WHERE id_sesion = ?", [id_sesion]);
  return rows.length === 1;
};

describe("limpieza de sesiones", () => {
  it("borra las vencidas hace más de 30 días (activas o cerradas) y conserva las demás", async () => {
    const usuario = await crearUsuario();
    const vieja = await sesion(usuario, -31);
    const viejaCerrada = await sesion(usuario, -45, false);
    const reciente = await sesion(usuario, -10);
    const vigente = await sesion(usuario, 5);

    const { sesiones } = await limpiarSesiones();
    expect(sesiones).toBeGreaterThanOrEqual(2);
    expect(await existe(vieja)).toBe(false);
    expect(await existe(viejaCerrada)).toBe(false);
    expect(await existe(reciente)).toBe(true);
    expect(await existe(vigente)).toBe(true);
  });

  it("el dispositivo de una sesión borrada sigue activo, sin sesión", async () => {
    const usuario = await crearUsuario();
    const vieja = await sesion(usuario, -40);
    const dispositivo = await crearDispositivo(usuario, { id_sesion: vieja });

    await limpiarSesiones();
    const [[fila]] = await pool.query("SELECT id_sesion, activo FROM dispositivos WHERE id_dispositivo = ?", [dispositivo.id_dispositivo]);
    expect(fila).toEqual({ id_sesion: null, activo: 1 });
  });

  it("quita los tokens de correo vencidos y conserva los vigentes", async () => {
    const vencido = await crearUsuario();
    const vigente = await crearUsuario();
    await pool.query(
      `UPDATE usuarios SET token_verificacion = ?, token_verificacion_expira = NOW() - INTERVAL 1 HOUR,
                           token_recuperacion = ?, token_recuperacion_expira = NOW() - INTERVAL 1 MINUTE
       WHERE id_usuario = ?`,
      [hash(), hash(), vencido.id_usuario]
    );
    const tokenVigente = hash();
    await pool.query("UPDATE usuarios SET token_recuperacion = ?, token_recuperacion_expira = NOW() + INTERVAL 1 HOUR WHERE id_usuario = ?", [
      tokenVigente,
      vigente.id_usuario,
    ]);

    await limpiarSesiones();
    const [[a]] = await pool.query(
      "SELECT token_verificacion, token_verificacion_expira, token_recuperacion, token_recuperacion_expira FROM usuarios WHERE id_usuario = ?",
      [vencido.id_usuario]
    );
    expect(a).toEqual({ token_verificacion: null, token_verificacion_expira: null, token_recuperacion: null, token_recuperacion_expira: null });
    const [[b]] = await pool.query("SELECT token_recuperacion FROM usuarios WHERE id_usuario = ?", [vigente.id_usuario]);
    expect(b.token_recuperacion).toBe(tokenVigente);
  });

  it("dos ejecuciones a la vez no fallan ni dejan nada pendiente", async () => {
    const usuario = await crearUsuario();
    const ids = [];
    for (let i = 0; i < 30; i++) ids.push(await sesion(usuario, -60));

    await Promise.all([limpiarSesiones(), limpiarSesiones()]);
    const [rows] = await pool.query("SELECT 1 FROM sesiones WHERE id_sesion IN (?)", [ids]);
    expect(rows).toHaveLength(0);
  });
});
