/** Búsqueda de lugares en la base propia (sin servicios externos). */
import { and, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { palabrasDeBusqueda } from "../normalizar";

export type Lugar = { nombre: string; tipo: string; distrito: string | null; fuente: string; coordenadas: [number, number] };

/** Barrios y centros poblados primero, luego lugares conocidos y calles; dentro, lo que empieza igual y lo más corto. */
export async function buscarLugares(q: string, limite = 8): Promise<Lugar[]> {
  const palabras = palabrasDeBusqueda(q);
  if (palabras.length === 0 || palabras.join("").length < 2) return [];
  const condiciones: SQL[] = palabras.map((p) => sql`name_norm LIKE ${"%" + p + "%"}`);
  const rows = await db.execute<{ nombre: string; tipo: string; distrito: string | null; fuente: string; lon: number; lat: number }>(sql`
    SELECT name AS nombre, kind AS tipo, district AS distrito, source AS fuente, ST_X(geom) AS lon, ST_Y(geom) AS lat
    FROM places
    WHERE ${and(...condiciones)}
    ORDER BY CASE kind WHEN 'barrio' THEN 0 WHEN 'centro_poblado' THEN 1 WHEN 'lugar' THEN 2 ELSE 3 END,
             (name_norm LIKE ${palabras[0] + "%"} OR name_norm LIKE ${"% " + palabras[0] + "%"}) DESC,
             length(name)
    LIMIT ${limite}`);
  return rows.map((r) => ({ nombre: r.nombre, tipo: r.tipo, distrito: r.distrito, fuente: r.fuente, coordenadas: [r.lon, r.lat] }));
}
