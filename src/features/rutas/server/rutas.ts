/**
 * Rutas a pie con los datos de la base: grafo de calles (en memoria, uno por peligro) y destinos.
 * El grafo se arma una vez y se reutiliza unos minutos (los datos solo cambian al recargar la base).
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Peligro } from "@/features/riesgo/peligros";
import { capaEvacuacion, tieneLugaresSeguros } from "@/features/riesgo/server/repositorio";
import { Grafo, type Ruta, type Tramo } from "../ruta";

type ConPeligro = "aluvion" | "huaico" | "inundacion_pluvial";
const COLUMNA: Record<ConPeligro | "ninguno", string> = {
  aluvion: "hazard_aluvion",
  huaico: "hazard_huaico",
  inundacion_pluvial: "hazard_inundacion",
  ninguno: "false",
};
const VIGENCIA_MS = 10 * 60 * 1000;
const cache = new Map<string, { hasta: number; grafo: Promise<Grafo> }>();

function grafo(peligro: ConPeligro | "ninguno"): Promise<Grafo> {
  const c = cache.get(peligro);
  if (c && c.hasta > Date.now()) return c.grafo;
  const promesa = (async () => {
    const filas = await db.execute<{ ax: number; ay: number; bx: number; by: number; largo: number; peligroso: boolean; calle: string | null }>(sql`
      SELECT ST_X(ST_StartPoint(sg.geom)) ax, ST_Y(ST_StartPoint(sg.geom)) ay, ST_X(ST_EndPoint(sg.geom)) bx, ST_Y(ST_EndPoint(sg.geom)) by,
             sg.length_m largo, ${sql.raw(COLUMNA[peligro])} AS peligroso, st.name AS calle
      FROM street_segments sg JOIN streets st ON st.id = sg.street_id`);
    return new Grafo(filas as unknown as Tramo[]);
  })();
  promesa.catch(() => cache.delete(peligro));
  cache.set(peligro, { hasta: Date.now() + VIGENCIA_MS, grafo: promesa });
  return promesa;
}

export type LugarSeguro = { id: number; nombre: string; tipo: string; referencia: string | null; precisionM: number | null };

/** Ruta a pie al lugar seguro válido para el peligro (en aluvión/huaico/inundación), evitando sus zonas. */
export async function rutaALugarSeguro(lon: number, lat: number, peligro: Peligro, idLugar?: number): Promise<Ruta<LugarSeguro> | null> {
  if (!tieneLugaresSeguros(peligro)) return null;
  const { zonas } = await capaEvacuacion(peligro);
  // En aluvión, la ruta automática va a zonas de seguridad y refugios (no a centros de acopio ni puestos de comando).
  const validos = zonas.features.filter((f) => {
    const p = f.properties;
    if (idLugar !== undefined) return p.id === idLugar;
    return peligro !== "aluvion" || p.tipo === "zona_seguridad" || p.tipo === "refugio_temporal";
  });
  const destinos = validos.map((f) => {
    const [x, y] = (f.geometry as { coordinates: [number, number] }).coordinates;
    const p = f.properties;
    return {
      lon: x,
      lat: y,
      dato: { id: Number(p.id), nombre: String(p.nombre ?? p.referencia ?? "Lugar seguro"), tipo: String(p.tipo), referencia: (p.referencia as string) ?? null, precisionM: (p.precision_m as number) ?? null },
    };
  });
  return (await grafo(peligro as ConPeligro)).ruta(lon, lat, destinos);
}

export type CentroSalud = {
  id: number;
  nombre: string;
  tipo: string;
  categoria: string | null;
  institucion: string | null;
  telefono: string | null;
  horario: string | null;
  emergencia24h: boolean | null;
  confianza: string;
  distanciaM: number;
  coordenadas: [number, number];
  /** Peligros con nivel alto en el lugar del centro (para avisar que en una emergencia puede no estar disponible). */
  enPeligro: string[];
};

/** Centros de salud más cercanos en línea recta, con aviso si están en una zona de peligro. */
export async function centrosCercanos(lon: number, lat: number, cantidad = 4): Promise<CentroSalud[]> {
  const p = sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
  const filas = await db.execute<Omit<CentroSalud, "coordenadas" | "enPeligro"> & { lon: number; lat: number; en_peligro: string[] | null }>(sql`
    SELECT h.id, h.name AS nombre, h.type AS tipo, h.category AS categoria, h.institution AS institucion, h.phone AS telefono,
           h.schedule AS horario, h.emergency_24h AS "emergencia24h", h.location_confidence AS confianza,
           ST_Distance(h.geom::geography, ${p}::geography) AS "distanciaM", ST_X(h.geom) lon, ST_Y(h.geom) lat,
           -- Solo aluvión y huaico: pueden dejar el local fuera de servicio. Una calle que se inunda cerca no.
           (SELECT array_agg(DISTINCT CASE hf.hazard_type_code WHEN 'aluvion' THEN 'aluvión' ELSE 'huaico' END)
              FROM hazard_features hf
             WHERE ST_DWithin(hf.geom, h.geom, 0.003)
               AND ST_DWithin(hf.geom::geography, h.geom::geography, coalesce(hf.approx_radius_m, 0))
               AND (GeometryType(hf.geom) <> 'POINT' OR coalesce(hf.approx_radius_m, 0) > 0)
               AND ((hf.hazard_type_code = 'aluvion' AND (hf.level >= 3 OR hf.category = 'evento_registrado'))
                 OR (hf.hazard_type_code = 'huaico' AND hf.category IN ('area_evaluada', 'evento_registrado')))) AS en_peligro
    FROM health_facilities h
    ORDER BY h.geom <-> ${p}
    LIMIT ${cantidad}`);
  return filas.map(({ lon: x, lat: y, en_peligro, ...r }) => ({ ...r, distanciaM: Math.round(r.distanciaM), coordenadas: [x, y], enPeligro: en_peligro ?? [] }));
}

/** Ruta a pie a un centro de salud concreto (sin penalizar zonas: es para llegar rápido). */
export async function rutaACentro(lon: number, lat: number, id: number): Promise<Ruta<{ id: number; nombre: string }> | null> {
  const [c] = await db.execute<{ id: number; nombre: string; lon: number; lat: number }>(sql`
    SELECT id, name AS nombre, ST_X(geom) lon, ST_Y(geom) lat FROM health_facilities WHERE id = ${id}`);
  if (!c) return null;
  return (await grafo("ninguno")).ruta(lon, lat, [{ lon: c.lon, lat: c.lat, dato: { id: c.id, nombre: c.nombre } }], false);
}

/** Todos los centros de salud, para dibujarlos en el mapa. */
export async function capaSalud() {
  const filas = await db.execute<{ id: number; nombre: string; tipo: string; telefono: string | null; geojson: string }>(sql`
    SELECT id, name AS nombre, type AS tipo, phone AS telefono, ST_AsGeoJSON(geom, 6) AS geojson FROM health_facilities`);
  return {
    type: "FeatureCollection" as const,
    features: filas.map(({ geojson, ...p }) => ({ type: "Feature" as const, geometry: JSON.parse(geojson), properties: p })),
  };
}
