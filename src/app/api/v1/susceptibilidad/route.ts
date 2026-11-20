import { capaSusceptibilidad } from "@/features/riesgo/server/repositorio";
import { jsonConEtag } from "@/features/riesgo/server/http";

export async function GET(req: Request) {
  return jsonConEtag(req, await capaSusceptibilidad());
}
