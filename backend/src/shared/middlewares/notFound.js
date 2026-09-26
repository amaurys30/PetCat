import { sendError } from "../utils/response.js";

export const notFound = (req, res) =>
  sendError(res, 404, `Ruta no encontrada: ${req.method} ${req.originalUrl.split("?")[0]}`);

export default notFound;
