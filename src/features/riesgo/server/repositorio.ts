/**
 * Consultas espaciales a PostGIS (solo servidor).
 * Devuelven GeoJSON listo para MapLibre y datos crudos para construir el veredicto.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { colorNivel, type Peligro } from "../peligros";
import { nivelElemento, type Hallazgo } from "../veredicto";

type Row = Record<string, unknown>;
export type FeatureCollection = { type: "FeatureCollection"; features: { type: "Feature"; geometry: unknown; properties: Row }[] };

function aColeccion(rows: Row[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map(({ geojson, ...props }) => ({ type: "Feature", geometry: JSON.parse(String(geojson)), properties: props })),
  };
}

/** Elementos de un peligro para dibujar en el mapa (sin la susceptibilidad regional, que va aparte). */
export async function capaPeligro(peligro: Peligro): Promise<FeatureCollection> {
  const rows = await db.execute<Row>(sql`
    SELECT hf.id, ${peligro} AS peligro, hf.category AS categoria, hf.level AS nivel, hf.level_label AS etiqueta,
           hf.location_confidence AS confianza, hf.approx_radius_m AS radio_m, hf.event_date AS fecha,
           hf.properties, d.title AS dataset, ds.institution AS institucion,
           ST_AsGeoJSON(hf.geom, 6) AS geojson
    FROM hazard_features hf
    JOIN datasets d ON d.id = hf.dataset_id
    JOIN data_sources ds ON ds.id = d.source_id
    WHERE d.published AND hf.category NOT IN ('susceptibilidad', 'pendiente', 'cauce')
      AND hf.hazard_type_code = ${peligro}
    ORDER BY hf.level NULLS FIRST`);
  const capa = aColeccion(rows);
  // Nivel y color con la misma regla del veredicto: el mapa y la tarjeta nunca se contradicen.
  for (const f of capa.features) {
    const p = f.properties;
    const n = nivelElemento({ peligro, categoria: p.categoria as Hallazgo["categoria"], nivel: p.nivel as number | null, confianza: p.confianza as Hallazgo["confianza"] });
    p.nivel_mapa = n;
    p.color = colorNivel(peligro, n);
  }
  return capa;
}

/** Susceptibilidad del terreno (solo media, alta y muy alta), simplificada para el mapa. */
export async function capaSusceptibilidad(): Promise<FeatureCollection> {
  const rows = await db.execute<Row>(sql`
    SELECT hf.level AS nivel, hf.level_label AS etiqueta,
           ST_AsGeoJSON(ST_SimplifyPreserveTopology(hf.geom, 0.00015), 5) AS geojson
    FROM hazard_features hf
    WHERE hf.category = 'susceptibilidad' AND hf.level >= 3`);
  return aColeccion(rows);
}

/** Manzanas con su nivel para un peligro. */
export async function capaManzanas(peligro: Peligro): Promise<FeatureCollection> {
  const rows = await db.execute<Row>(sql`
    SELECT b.id, b.zone AS zona, b.block AS manzana, h.level AS nivel, h.details AS detalle,
           ST_AsGeoJSON(b.geom, 6) AS geojson
    FROM city_blocks b
    JOIN city_block_hazards h ON h.block_id = b.id AND h.hazard_type_code = ${peligro}`);
  return aColeccion(rows);
}

/**
 * Lugares seguros según el peligro (todos vienen del mapa oficial de evacuación de mayo 2025):
 * - aluvión: todos los puntos del mapa (zonas de seguridad, refugios, acopio, atención médica…) y las flechas.
 * - huaico: zonas de seguridad y refugios temporales, quitando los que caen dentro de una zona de huaico.
 * - inundación: solo refugios temporales (las áreas verdes no sirven para la lluvia), quitando los que se inundan.
 */
export const TIPOS_SEGUROS: Partial<Record<Peligro, string[] | null>> = {
  aluvion: null, // null = todos
  huaico: ["zona_seguridad", "refugio_temporal"],
  inundacion_pluvial: ["refugio_temporal"],
};

export function tieneLugaresSeguros(peligro: Peligro): boolean {
  return peligro in TIPOS_SEGUROS;
}

/** Condición SQL: el punto `z` es apto como lugar seguro para el peligro (tipo y fuera de sus zonas). */
function zonaValida(peligro: Peligro) {
  const tipos = TIPOS_SEGUROS[peligro];
  const filtroTipo = tipos ? sql`AND z.type::text IN (${sql.join(tipos.map((t) => sql`${t}`), sql`, `)})` : sql``;
  const fueraDelPeligro =
    peligro === "aluvion"
      ? sql``
      : sql`AND NOT EXISTS (
          SELECT 1 FROM hazard_features hf
          WHERE hf.hazard_type_code = ${peligro} AND hf.category NOT IN ('cauce', 'susceptibilidad', 'pendiente')
            AND ST_DWithin(z.geom::geography, hf.geom::geography, COALESCE(hf.approx_radius_m, 0)))`;
  return sql`${filtroTipo} ${fueraDelPeligro}`;
}

/** Lugares seguros y flechas de evacuación para un peligro (vacío si no aplica). */
export async function capaEvacuacion(peligro: Peligro): Promise<{ zonas: FeatureCollection; flechas: FeatureCollection }> {
  const vacia: FeatureCollection = { type: "FeatureCollection", features: [] };
  if (!tieneLugaresSeguros(peligro)) return { zonas: vacia, flechas: vacia };
  const [zonas, flechas] = await Promise.all([
    db.execute<Row>(sql`
      SELECT z.id, z.type AS tipo, z.name AS nombre, z.reference AS referencia, z.precision_m AS precision_m,
             z.verification_status AS estado, ST_AsGeoJSON(z.geom, 6) AS geojson
      FROM safe_zones z JOIN datasets d ON d.id = z.dataset_id WHERE d.published ${zonaValida(peligro)}`),
    peligro !== "aluvion" // las flechas son del plan de evacuación ante aluvión
      ? Promise.resolve([] as Row[])
      : db.execute<Row>(sql`
      SELECT a.bearing_deg AS rumbo, ST_AsGeoJSON(a.geom, 6) AS geojson
      FROM evacuation_arrows a JOIN datasets d ON d.id = a.dataset_id WHERE d.published`),
  ]);
  return { zonas: aColeccion(zonas), flechas: aColeccion(flechas) };
}

// --- Consulta de un punto -----------------------------------------------------------

export type FilaCercana = {
  peligro: Peligro;
  categoria: string;
  nivel: number | null;
  etiqueta: string | null;
  confianza: "alta" | "media" | "baja";
  radio_m: number | null;
  fecha: string | null;
  properties: Record<string, unknown>;
  dataset: string;
  institucion: string;
  url: string | null;
  distancia_m: number;
  intersecta: boolean;
};

const BUSQUEDA_M = 500;

/** Todo lo que hay a menos de ~500 m (más el radio aproximado) de un punto. */
export async function elementosCercanos(lon: number, lat: number): Promise<FilaCercana[]> {
  const p = sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
  return db.execute<FilaCercana>(sql`
    SELECT hf.hazard_type_code AS peligro, hf.category AS categoria, hf.level AS nivel, hf.level_label AS etiqueta,
           hf.location_confidence AS confianza, hf.approx_radius_m AS radio_m, hf.event_date AS fecha, hf.properties,
           d.title AS dataset, ds.institution AS institucion, ds.url,
           ST_Distance(hf.geom::geography, ${p}::geography) AS distancia_m,
           ST_Intersects(hf.geom, ${p}) AS intersecta
    FROM hazard_features hf
    JOIN datasets d ON d.id = hf.dataset_id
    JOIN data_sources ds ON ds.id = d.source_id
    WHERE d.published
      AND ST_DWithin(hf.geom, ${p}, 0.009)  -- prefiltro con índice (~1 km)
      AND ST_DWithin(hf.geom::geography, ${p}::geography, COALESCE(hf.approx_radius_m, 0) + ${BUSQUEDA_M})`);
}

/** ¿Algún dataset del peligro declara cobertura sobre el punto? */
export async function coberturaEn(lon: number, lat: number): Promise<Set<string>> {
  const rows = await db.execute<{ peligro: string }>(sql`
    SELECT DISTINCT hazard_type_code AS peligro FROM datasets
    WHERE published AND coverage IS NOT NULL AND hazard_type_code IS NOT NULL
      AND ST_Contains(coverage, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`);
  return new Set(rows.map((r) => r.peligro));
}

export async function zonaSeguraMasCercana(lon: number, lat: number, peligro: Peligro) {
  const p = sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
  // En aluvión se proponen solo zonas de seguridad y refugios (no centros de acopio ni puestos de comando).
  const filtro = peligro === "aluvion" ? sql`AND z.type IN ('zona_seguridad', 'refugio_temporal')` : zonaValida(peligro);
  const rows = await db.execute<{ nombre: string | null; referencia: string | null; tipo: string; distancia_m: number; lon: number; lat: number }>(sql`
    SELECT z.name AS nombre, z.reference AS referencia, z.type AS tipo,
           ST_Distance(z.geom::geography, ${p}::geography) AS distancia_m, ST_X(z.geom) AS lon, ST_Y(z.geom) AS lat
    FROM safe_zones z
    WHERE true ${filtro}
    ORDER BY z.geom <-> ${p} LIMIT 1`);
  return rows[0] ?? null;
}

export async function manzanaEn(lon: number, lat: number) {
  const rows = await db.execute<{ id: string; zona: string; manzana: string; niveles: Record<string, number>; detalles: Record<string, string[]> }>(sql`
    SELECT b.id, b.zone AS zona, b.block AS manzana,
           jsonb_object_agg(h.hazard_type_code, h.level) AS niveles,
           jsonb_object_agg(h.hazard_type_code, h.details) AS detalles
    FROM city_blocks b JOIN city_block_hazards h ON h.block_id = b.id
    WHERE ST_Contains(b.geom, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))
    GROUP BY b.id LIMIT 1`);
  return rows[0] ?? null;
}

/** Años (desde 2018) con eventos registrados por peligro: inventario, eventos recientes y noticias. */
export async function aniosConEventos(): Promise<Record<string, number[]>> {
  const rows = await db.execute<{ peligro: string; anios: number[] }>(sql`
    SELECT p AS peligro, array_agg(DISTINCT anio ORDER BY anio) AS anios FROM (
      SELECT hazard_type_code p, left(event_date, 4)::int anio FROM hazard_features
      WHERE category = 'evento_registrado' AND event_date ~ '^[0-9]{4}'
      UNION ALL
      SELECT hf.hazard_type_code, left(e->>'fecha', 4)::int FROM hazard_features hf, jsonb_array_elements(hf.properties->'eventos') e
      WHERE e->>'fecha' ~ '^[0-9]{4}'
    ) t WHERE anio >= 2018 GROUP BY p`);
  return Object.fromEntries(rows.map((r) => [r.peligro, r.anios]));
}
