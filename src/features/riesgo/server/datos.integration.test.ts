// @vitest-environment node
/**
 * Pruebas de integración sobre los datos cargados (npm run datos:todo).
 * Se omiten si no hay base o si la base está vacía (p. ej. en CI, que no carga los datos de Huaraz).
 *
 * Cuidan las reglas que el usuario pidió y que ya se rompieron alguna vez:
 * - el mapa (color de la manzana) y la tarjeta (consulta de un punto) nunca se contradicen;
 * - todo huaico documentado o zona crítica está conectado con un camino aguas abajo;
 * - el inventario no repite eventos ya investigados, y las noticias nunca se borran.
 */
import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { PELIGROS } from "../peligros";
import { consultarPunto } from "./consulta";

const url = process.env.DATABASE_URL;
const sql = url ? postgres(url, { max: 2, onnotice: () => {} }) : undefined;
const hayDatos = sql ? Number((await sql`SELECT count(*) AS n FROM city_blocks`)[0].n) > 0 : false;

describe.skipIf(!hayDatos)("datos de Huaraz (integración)", () => {
  afterAll(async () => {
    await sql?.end();
  });

  it("el color de cada manzana coincide con la tarjeta en su interior (6 peligros)", async () => {
    // Muestra fija: hasta 15 manzanas con nivel ≠ 0 y 5 sin nivel por peligro.
    const muestra = await sql!<{ id: string; peligro: string; nivel: number; lon: number; lat: number }[]>`
      SELECT * FROM (
        SELECT b.id, h.hazard_type_code AS peligro, h.level AS nivel,
               ST_X(ST_PointOnSurface(b.geom)) AS lon, ST_Y(ST_PointOnSurface(b.geom)) AS lat,
               row_number() OVER (PARTITION BY h.hazard_type_code, h.level <> 0 ORDER BY md5(b.id)) AS r,
               h.level <> 0 AS con_nivel
        FROM city_blocks b JOIN city_block_hazards h ON h.block_id = b.id
      ) t
      WHERE (con_nivel AND r <= 15) OR (NOT con_nivel AND r <= 5)`;
    const diferencias: string[] = [];
    for (const m of muestra) {
      const r = await consultarPunto(m.lon, m.lat);
      if (r.manzana?.id !== m.id) continue;
      const n = r.veredictos[m.peligro as (typeof PELIGROS)[number]].nivel;
      if (n !== m.nivel) diferencias.push(`${m.peligro} manzana ${m.id}: mapa ${m.nivel}, tarjeta ${n}`);
    }
    expect(muestra.length).toBeGreaterThan(50);
    expect(diferencias).toEqual([]);
  }, 120_000);

  it("todo huaico documentado o zona crítica tiene su camino aguas abajo", async () => {
    const sinCamino = await sql!<{ nombre: string }[]>`
      SELECT coalesce(o.properties->>'lugar', o.properties->>'paraje', o.properties->>'sector', o.id::text) AS nombre
      FROM hazard_features o
      WHERE o.hazard_type_code = 'huaico' AND o.category IN ('evento_registrado', 'area_evaluada', 'zona_critica')
        AND coalesce((o.properties->>'es_recorrido')::boolean, false) = false
        AND NOT EXISTS (SELECT 1 FROM hazard_features c WHERE c.category = 'camino_aguas_abajo'
                        AND ST_DWithin(c.geom::geography, ST_PointOnSurface(o.geom)::geography, 60))`;
    expect(sinCamino.map((x) => x.nombre)).toEqual([]);
  });

  it("el inventario no repite eventos ya investigados (mismo peligro, ≤ 50 m)", async () => {
    const [{ n }] = await sql!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM hazard_features a JOIN hazard_features b
        ON a.hazard_type_code = b.hazard_type_code AND a.id <> b.id
       AND a.category = 'evento_registrado' AND b.category = 'evento_registrado'
       AND GeometryType(a.geom) = 'POINT' AND GeometryType(b.geom) = 'POINT'
       AND ST_DWithin(a.geom::geography, b.geom::geography, 50)
      WHERE a.dataset_id = (SELECT id FROM datasets WHERE title = 'Inventario de peligros geológicos (puntos)')
        AND b.dataset_id IN (SELECT id FROM datasets WHERE title LIKE 'Eventos recientes de %')`;
    expect(n).toBe(0);
  });

  it("las inundaciones de las noticias están todas (nunca se borran como repetidas)", async () => {
    const [{ n }] = await sql!<{ n: number }[]>`
      SELECT count(*)::int AS n FROM hazard_features hf JOIN datasets d ON d.id = hf.dataset_id
      WHERE d.title = 'Inundaciones por lluvia reportadas en noticias'`;
    const { readFileSync } = await import("node:fs");
    const archivo = JSON.parse(readFileSync("data/raw/huaraz/noticias_inundaciones.json", "utf8"));
    expect(n).toBe(archivo.lugares.length);
  });
});
