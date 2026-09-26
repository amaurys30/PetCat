/** IP y user agent de la petición, que se guardan con la sesión (login y aceptar invitación). */
export const clienteDe = (req) => ({
  ip: req.ip ?? null,
  userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
});
