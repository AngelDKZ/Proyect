import { esPeligro } from "@/features/riesgo/peligros";
import { capaEvacuacion } from "@/features/riesgo/server/repositorio";
import { errorJson, jsonConEtag } from "@/features/riesgo/server/http";

/** GET /api/v1/evacuacion?peligro=huaico → lugares seguros (y flechas) válidos para ese peligro. */
export async function GET(req: Request) {
  const peligro = new URL(req.url).searchParams.get("peligro") ?? "aluvion";
  if (!esPeligro(peligro)) return errorJson(404, "Peligro desconocido");
  return jsonConEtag(req, await capaEvacuacion(peligro));
}
