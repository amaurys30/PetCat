/**
 * Formato único de respuesta de la API:
 *   { success: true,  message, data }
 *   { success: true,  message, data: [...], meta: { total, page, limit, totalPages, hasNext } }
 *   { success: false, message, errors? }
 */

export const ok = (res, data = null, message = "OK") =>
  res.status(200).json({ success: true, message, data });

export const created = (res, data = null, message = "Creado correctamente") =>
  res.status(201).json({ success: true, message, data });

export const paginated = (res, rows, meta, message = "OK") =>
  res.status(200).json({ success: true, message, data: rows, meta });

export const sendError = (res, status, message, errors) =>
  res.status(status).json({
    success: false,
    message,
    ...(errors && Object.keys(errors).length > 0 && { errors }),
  });
