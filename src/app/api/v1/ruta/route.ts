import { z } from "zod";
import { esPeligro } from "@/features/riesgo/peligros";
import { errorJson } from "@/features/riesgo/server/http";
import { rutaACentro, rutaALugarSeguro } from "@/features/rutas/server/rutas";

const Consulta = z.object({
  lon: z.coerce.number().min(-77.75).max(-77.3),
  lat: z.coerce.number().min(-9.75).max(-9.3),
  peligro: z.string().optional(),
  lugar: z.coerce.number().int().positive().optional(),
  salud: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/v1/ruta?lon&lat&peligro=aluvion        → ruta a pie al lugar seguro más conveniente (evita zonas de peligro)
 * GET /api/v1/ruta?lon&lat&peligro=aluvion&lugar=7 → ruta a un lugar seguro concreto
 * GET /api/v1/ruta?lon&lat&salud=12               → ruta a pie a un centro de salud
 */
export async function GET(req: Request) {
  const p = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return errorJson(422, "Ese punto está fuera del área piloto o faltan datos.");
  const { lon, lat, peligro, lugar, salud } = p.data;
  const ruta = salud
    ? await rutaACentro(lon, lat, salud)
    : peligro && esPeligro(peligro)
      ? await rutaALugarSeguro(lon, lat, peligro, lugar)
      : null;
  if (!ruta) return errorJson(404, "No encontramos una ruta a pie desde ese punto (no hay calles cerca o no hay destino para ese peligro).");
  return Response.json(ruta, { headers: { "Cache-Control": "no-store" } });
}
