/** Utilidades HTTP compartidas por los Route Handlers de la API. */
import { esPeligro, type Peligro } from "../peligros";

import { createHash } from "node:crypto";

/**
 * Los datos cambian solo al recargar la base. El navegador siempre pregunta si cambiaron (ETag):
 * si no cambiaron recibe un 304 sin cuerpo; si cambiaron, los nuevos. Antes se guardaban hasta un día
 * y el mapa podía mostrar capas viejas mientras la tarjeta ya usaba los datos nuevos.
 */
export const CACHE_DATOS = { "Cache-Control": "public, max-age=0, must-revalidate, s-maxage=60" };

export function jsonConEtag(req: Request, datos: unknown): Response {
  const cuerpo = JSON.stringify(datos);
  const etag = `W/"${createHash("sha1").update(cuerpo).digest("base64url")}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ...CACHE_DATOS, ETag: etag } });
  return new Response(cuerpo, { headers: { ...CACHE_DATOS, ETag: etag, "Content-Type": "application/json" } });
}

export function errorJson(estado: number, mensaje: string) {
  return Response.json({ error: mensaje }, { status: estado });
}

export async function peligroDeParams(params: Promise<{ peligro: string }>): Promise<Peligro | null> {
  const { peligro } = await params;
  return esPeligro(peligro) ? peligro : null;
}
