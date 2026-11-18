import { create } from "axios";

import { API_URL } from "./config";
import { normalizarError } from "./errores";

// Cliente único de la API. Las pantallas nunca lo usan directo: cada módulo expone sus
// funciones en src/api/<modulo>.ts. La sesión (token y renovación) llega con el acceso.
export const api = create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => Promise.reject(normalizarError(error)),
);

// Respuestas de la API: { success, message, data, meta? }.
export type Respuesta<T> = { success: true; message: string; data: T };
