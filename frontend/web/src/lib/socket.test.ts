import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { socketFalso, sockets } from "@/test/socketFalso";
import { cerrarSocket, conectarSocket, getEstadoConexion } from "./socket";

const renovar = vi.hoisted(() => vi.fn<() => Promise<string>>());
vi.mock("@/api/sesion", () => ({ getAccessToken: () => "token-vigente", renovarSesion: renovar }));

beforeEach(() => {
  renovar.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  cerrarSocket();
  vi.useRealTimers();
});

describe("lib/socket", () => {
  it("una conexión por usuario: reutiliza la del mismo y abre otra al cambiar de cuenta", () => {
    const a = conectarSocket(1);
    expect(conectarSocket(1)).toBe(a);
    expect(getEstadoConexion()).toBe("conectando");
    socketFalso().conectar();
    expect(getEstadoConexion()).toBe("conectado");

    const b = conectarSocket(2);
    expect(b).not.toBe(a);
    expect(sockets[0]!.active).toBe(false);
    cerrarSocket();
    expect(getEstadoConexion()).toBe("cerrado");
  });

  it("token rechazado (401): renueva la sesión una vez y vuelve a conectar", async () => {
    renovar.mockResolvedValue("token-nuevo");
    conectarSocket(1);
    const socket = socketFalso();
    socket.rechazar("Token expirado", 401);
    expect(getEstadoConexion()).toBe("desconectado");
    await vi.waitFor(() => expect(socket.conexiones).toBe(1));
    expect(renovar).toHaveBeenCalledTimes(1);

    // Si el token nuevo también se rechaza, no renueva otra vez: reintenta al minuto.
    socket.rechazar("Sesión inválida o expirada", 401);
    expect(renovar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(socket.conexiones).toBe(2);
  });

  it("si la renovación falla no reconecta (la sesión se cierra)", async () => {
    renovar.mockRejectedValue(new Error("expirada"));
    conectarSocket(1);
    const socket = socketFalso();
    socket.rechazar("Token expirado", 401);
    await vi.waitFor(() => expect(renovar).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(1000);
    expect(socket.conexiones).toBe(0);
  });

  it("una caída de red la reintenta Socket.IO: no renueva ni llama connect", () => {
    conectarSocket(1);
    const socket = socketFalso();
    socket.conectar();
    socket.perderConexion();
    expect(getEstadoConexion()).toBe("desconectado");
    expect(renovar).not.toHaveBeenCalled();
    expect(socket.conexiones).toBe(0);
  });
});
