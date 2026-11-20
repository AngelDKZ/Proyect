import { z } from "zod";
import { consultarPunto } from "@/features/riesgo/server/consulta";
import { errorJson } from "@/features/riesgo/server/http";

// Área piloto (Huaraz e Independencia, con margen). Fuera de ella no hay datos cargados.
const AREA_PILOTO = { oeste: -77.75, este: -77.3, sur: -9.75, norte: -9.3 };

const Entrada = z.object({
  lon: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Entrada.safeParse({ lon: url.searchParams.get("lon"), lat: url.searchParams.get("lat") });
  if (!parsed.success) return errorJson(400, "Parámetros inválidos: se requieren lon y lat numéricos");
  const { lon, lat } = parsed.data;
  if (lon < AREA_PILOTO.oeste || lon > AREA_PILOTO.este || lat < AREA_PILOTO.sur || lat > AREA_PILOTO.norte)
    return errorJson(422, "El punto está fuera del área piloto (Huaraz e Independencia)");
  return Response.json(await consultarPunto(lon, lat), { headers: { "Cache-Control": "no-store" } });
}
