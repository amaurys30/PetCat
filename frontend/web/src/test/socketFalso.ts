import { act } from "react";

type Oyente = (...args: never[]) => void;

/**
 * Socket.IO simulado (setup.ts reemplaza socket.io-client por este). Empieza sin conectar;
 * las pruebas lo manejan con `socketFalso()`: conectar, recibir eventos del servidor o perder
 * la conexión.
 */
export class SocketFalso {
  connected = false;
  active = true;
  conexiones = 0;
  readonly url: string | undefined;
  readonly opciones: Record<string, unknown>;
  private oyentes = new Map<string, Set<Oyente>>();

  constructor(url: string | undefined, opciones: Record<string, unknown>) {
    this.url = url;
    this.opciones = opciones;
  }

  on(evento: string, oyente: Oyente) {
    if (!this.oyentes.has(evento)) this.oyentes.set(evento, new Set());
    this.oyentes.get(evento)!.add(oyente);
    return this;
  }

  off(evento: string, oyente: Oyente) {
    this.oyentes.get(evento)?.delete(oyente);
    return this;
  }

  removeAllListeners() {
    this.oyentes.clear();
    return this;
  }

  connect() {
    this.conexiones += 1;
    this.active = true;
    return this;
  }

  disconnect() {
    this.connected = false;
    this.active = false;
    return this;
  }

  /** El servidor emite `evento` (dentro de act: actualiza la interfaz). */
  recibir(evento: string, ...datos: unknown[]) {
    act(() => {
      for (const oyente of [...(this.oyentes.get(evento) ?? [])])
        (oyente as (...a: unknown[]) => void)(...datos);
    });
  }

  conectar() {
    this.connected = true;
    this.recibir("connect");
  }

  /** Caída de red: Socket.IO sigue reintentando (active). */
  perderConexion() {
    this.connected = false;
    this.recibir("disconnect", "transport close");
    this.recibir("connect_error", new Error("websocket error"));
  }

  /** Rechazo del servidor en el handshake (p. ej. token expirado): ya no reintenta solo. */
  rechazar(mensaje: string, status: number) {
    this.active = false;
    this.recibir("connect_error", Object.assign(new Error(mensaje), { data: { status } }));
  }
}

export const sockets: SocketFalso[] = [];

/** El último socket abierto. */
export function socketFalso(): SocketFalso {
  const socket = sockets.at(-1);
  if (!socket) throw new Error("No se abrió ningún socket");
  return socket;
}

export const io = (url: string | undefined, opciones: Record<string, unknown>) => {
  const socket = new SocketFalso(url, opciones);
  sockets.push(socket);
  return socket;
};
