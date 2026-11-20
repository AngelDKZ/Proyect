import { capaManzanas } from "@/features/riesgo/server/repositorio";
import { errorJson, jsonConEtag, peligroDeParams } from "@/features/riesgo/server/http";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/peligros/[peligro]/manzanas">) {
  const peligro = await peligroDeParams(ctx.params);
  if (!peligro) return errorJson(404, "Peligro desconocido");
  return jsonConEtag(req, await capaManzanas(peligro));
}
