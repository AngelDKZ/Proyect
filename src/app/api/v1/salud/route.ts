import { z } from "zod";
import { errorJson, jsonConEtag } from "@/features/riesgo/server/http";
import { capaSalud, centrosCercanos } from "@/features/rutas/server/rutas";

const Consulta = z.object({ lon: z.coerce.number().min(-77.75).max(-77.3), lat: z.coerce.number().min(-9.75).max(-9.3) });

/**
 * GET /api/v1/salud?lon&lat → centros de salud más cercanos, con aviso si están en zona de peligro.
 * GET /api/v1/salud?todos  → todos los centros (capa del mapa).
 */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.has("todos")) return jsonConEtag(req, await capaSalud());
  const p = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return errorJson(422, "Ese punto está fuera del área piloto.");
  return Response.json({ centros: await centrosCercanos(p.data.lon, p.data.lat) }, { headers: { "Cache-Control": "no-store" } });
}
