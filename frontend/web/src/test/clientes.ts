import type { ClienteDetalle, ClienteFila, NotaCliente } from "@/api/clientes";

export const clienteFilaDemo = (cambios: Partial<ClienteFila> = {}): ClienteFila => ({
  id_usuario: 20,
  nombre: "Laura",
  apellido: "Gómez",
  email: "laura@petcat.test",
  telefono: "300 123 4567",
  total_citas: 14,
  ultima_cita: "2026-09-12",
  proxima_cita: null,
  inasistencias: 0,
  usa_app: true,
  registrado_por_el_negocio: false,
  cliente_desde: "2026-02-10",
  ...cambios,
});

export const notaDemo = (cambios: Partial<NotaCliente> = {}): NotaCliente => ({
  id_nota: 1,
  texto: "Prefiere que la llamen en la tarde.",
  autor: { id_usuario: 2, nombre: "Valentina", apellido: "Torres" },
  fecha_creacion: "2026-09-12 10:15:00",
  fecha_edicion: null,
  editable: true,
  eliminable: true,
  ...cambios,
});

type CambiosDetalle = Omit<Partial<ClienteDetalle>, "cliente"> & {
  cliente?: Partial<ClienteDetalle["cliente"]>;
};

export const clienteDetalleDemo = ({ cliente, ...cambios }: CambiosDetalle = {}): ClienteDetalle => ({
  cliente: {
    id_usuario: 20,
    nombre: "Laura",
    apellido: "Gómez",
    email: "laura@petcat.test",
    telefono: "300 123 4567",
    cliente_desde: "2026-02-10",
    registrado_por_el_negocio: false,
    usa_app: true,
    correo_editable: false,
    ...cliente,
  },
  historial_cumplimiento: { completadas: 14, inasistencias: 0, cancelaciones_tardias: 1 },
  mascotas: [
    {
      id_mascota: 31,
      nombre: "Max",
      especie: "perro",
      raza: "Labrador",
      edad_meses: 74,
      peso: 28,
      tiene_alergias: true,
      alergias_detalle: "penicilina",
      condiciones_medicas: null,
      fallecido: false,
      citas_con_negocio: 12,
      acceso_historial: true,
    },
    {
      id_mascota: 32,
      nombre: "Rocky",
      especie: "perro",
      raza: "Criollo",
      edad_meses: 144,
      peso: null,
      tiene_alergias: false,
      alergias_detalle: null,
      condiciones_medicas: null,
      fallecido: true,
      citas_con_negocio: 2,
      acceso_historial: true,
    },
  ],
  citas: { proximas: [], recientes: [] },
  notas_recientes: [],
  total_notas: 0,
  ...cambios,
});
