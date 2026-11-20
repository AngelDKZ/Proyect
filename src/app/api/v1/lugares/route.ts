import { z } from "zod";
import { buscarLugares } from "@/features/lugares/server/buscar";
import { errorJson } from "@/features/riesgo/server/http";

const Consulta = z.object({ q: z.string().trim().min(1).max(80) });

/** GET /api/v1/lugares?q=shancayan → barrios, centros poblados, lugares y calles de Huaraz. */
export async function GET(req: Request) {
  const p = Consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return errorJson(400, "Escribe qué lugar buscas (q).");
  const lugares = await buscarLugares(p.data.q);
  return Response.json({ lugares }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
