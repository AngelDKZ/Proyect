/**
 * Carga en PostgreSQL/PostGIS todas las capas procesadas del piloto Huaraz e Independencia.
 *
 * Es idempotente: borra y vuelve a cargar todo dentro de una sola transacción
 * (si algo falla, la base queda como estaba).
 *
 * Uso:  npm run db:cargar
 * Entradas: data/raw/inei/*.geojson, data/processed/huaraz/*.geojson, data/raw/huaraz/noticias_inundaciones.json
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../../src/lib/db/schema";
import type { Geometry, MultiPolygon } from "../../src/lib/db/geometry";
import { normalizar } from "../../src/features/lugares/normalizar";
import { telefonosLegibles } from "../../src/features/rutas/telefono";
import { PELIGROS, type Peligro } from "../../src/features/riesgo/peligros";
import { CATEGORIAS_CERCA, type Hallazgo, nivelElemento, RADIO_CERCA_M } from "../../src/features/riesgo/veredicto";

const ROOT = path.resolve(__dirname, "../..");
const PROC = path.join(ROOT, "data/processed/huaraz");
const INEI = path.join(ROOT, "data/raw/inei");

if (existsSync(path.join(ROOT, ".env"))) process.loadEnvFile(path.join(ROOT, ".env"));
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");

type Feature = { type: "Feature"; properties: Record<string, any>; geometry: Geometry };
type FC = { features: Feature[]; [k: string]: any };
const leer = (archivo: string): FC => JSON.parse(readFileSync(archivo, "utf8"));
const proc = (n: string) => leer(path.join(PROC, n));

const multi = (g: Geometry): MultiPolygon => {
  if (g.type === "MultiPolygon") return g;
  if (g.type === "Polygon") return { type: "MultiPolygon", coordinates: [g.coordinates] };
  throw new Error(`Se esperaba un polígono y llegó ${g.type}`);
};

/** Clasifica un elemento del INGEMMET en tipos de peligro (misma regla que el visor de revisión). */
function categoriasIngemmet(p: Record<string, any>): string[] {
  const t = [p.PELIGRO_ES, p.NOM_PELIGRO_TXT, p.TIP_PELIGRO_TXT, p.PELIGROS_G].filter(Boolean).join(" ").toLowerCase();
  const c: string[] = [];
  if (/flujo|huaico/.test(t)) c.push("huaico");
  if (/desliz|reptaci|movimiento complejo/.test(t)) c.push("deslizamiento");
  if (/ca[ií]da|derrumbe|avalancha de rocas/.test(t)) c.push("caida");
  if (/erosi|c[aá]rcava|bad lands/.test(t)) c.push("erosion");
  if (/inundaci/.test(t)) c.push("inundacion_pluvial");
  return c;
}

const NIVEL_ALUVION: Record<string, number> = { bajo: 1, medio: 2, alto: 3, muy_alto: 4 };
const ETIQUETA_ALUVION: Record<string, string> = { bajo: "Bajo", medio: "Medio", alto: "Alto", muy_alto: "Muy alto" };
const SUSC_TXT: Record<number, string> = { 1: "Muy baja", 2: "Baja", 3: "Media", 4: "Alta", 5: "Muy alta" };

async function enLotes<T>(filas: T[], tam: number, fn: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += tam) await fn(filas.slice(i, i + tam));
}

const PELIGROS_RECIENTES = ["huaico", "deslizamiento", "erosion", "caida", "inundacion_pluvial"] as const;
const ARCHIVO_PELIGRO: Record<string, string> = { huaico: "huaico", deslizamiento: "deslizamiento", erosion: "erosion", caida: "caida", inundacion_pluvial: "inundacion" };
const NOMBRE_PELIGRO: Record<string, string> = { huaico: "huaico", deslizamiento: "deslizamiento", erosion: "erosión", caida: "caída de rocas", inundacion_pluvial: "inundación por lluvias" };
/** Radio aproximado según qué tan precisa es la ubicación del evento. */
const RADIO_CONFIANZA = { alta: 60, media: 150, baja: 300 } as const;

/** "CENTRO DE SALUD HUARUPAMPA" → "Centro de Salud Huarupampa" (respeta siglas y números). */
function nombrePropio(t: string): string {
  const menores = new Set(["de", "del", "la", "las", "los", "y", "e", "en"]);
  const siglas = new Set(["II", "III", "IV", "SAC", "S.A.C.", "EIRL", "E.I.R.L.", "SRL", "S.R.L.", "BIM", "PNP", "IPRESS", "CS", "PS", "CM"]);
  return t
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (siglas.has(w.toUpperCase()) || /\d/.test(w)) return w.toUpperCase();
      const l = w.toLowerCase();
      return i > 0 && menores.has(l) ? l : l.charAt(0).toUpperCase() + l.slice(1);
    })
    .join(" ");
}

/** "SAN MARTIN DE PORRES" → "San Martin De Porres" (los nombres del INEI vienen en mayúsculas). */
function titulo(t: string | null): string {
  return String(t ?? "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function puntoDe(g: any) {
  return g.type === "MultiPoint" ? { type: "Point", coordinates: g.coordinates[0] } : g;
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema: s });
  const ahora = new Date();
  const conteo: Record<string, number> = {};
  const suma = (k: string, n: number) => (conteo[k] = (conteo[k] ?? 0) + n);

  await db.transaction(async (tx) => {
    // 1) Vaciar (orden inverso a las dependencias)
    await tx.execute(sql`TRUNCATE health_facilities, street_segments, streets, places, city_block_hazards, city_blocks, evacuation_arrows, safe_zone_hazards, safe_zones,
      hazard_features, datasets, data_sources, hazard_types, territorial_units RESTART IDENTITY CASCADE`);

    // 2) Tipos de peligro
    await tx.insert(s.hazardTypes).values([
      { code: "aluvion", name: "Aluvión", description: "Flujo de lodo y piedras por el desborde de una laguna glaciar (Palcacocha → río Quillcay)." },
      { code: "inundacion_pluvial", name: "Inundación por lluvias", description: "Aniegos e inundaciones de calles y viviendas por lluvias intensas." },
      { code: "huaico", name: "Huaico", description: "Flujo de lodo y piedras que baja por una quebrada, sobre todo con lluvias intensas." },
      { code: "deslizamiento", name: "Deslizamiento", description: "Una porción de ladera se desliza cerro abajo; incluye la reptación." },
      { code: "caida", name: "Caída de rocas y derrumbes", description: "Rocas o bloques que se desprenden de laderas empinadas." },
      { code: "erosion", name: "Erosión", description: "El agua desgasta la ladera (cárcavas) o las orillas de los ríos." },
    ]);

    // 3) Territorio (INEI)
    const dep = leer(path.join(INEI, "departamento_ancash.geojson")).features[0];
    const prov = leer(path.join(INEI, "provincia_huaraz.geojson")).features[0];
    const dist = leer(path.join(INEI, "distritos_huaraz_independencia.geojson")).features;
    await tx.insert(s.territorialUnits).values([
      { ubigeo: "02", name: "Áncash", level: "departamento", parentUbigeo: null, geom: multi(dep.geometry) },
      { ubigeo: "0201", name: "Huaraz", level: "provincia", parentUbigeo: "02", geom: multi(prov.geometry) },
      ...dist.map((d) => ({
        ubigeo: d.properties.ubigeo as string,
        name: d.properties.ubigeo === "020101" ? "Huaraz" : "Independencia",
        level: "distrito" as const,
        parentUbigeo: "0201",
        geom: multi(d.geometry),
      })),
    ]);
    await tx.execute(sql`UPDATE territorial_units SET geom_simplified = ST_Multi(ST_SimplifyPreserveTopology(geom, 0.0005))`);
    suma("territorial_units", 2 + dist.length);

    // 4) Fuentes
    const fuente = async (v: typeof s.dataSources.$inferInsert) => (await tx.insert(s.dataSources).values(v).returning())[0].id;
    const fMapa = await fuente({ institution: "Municipalidad Provincial de Huaraz / INAIGEM / Municipalidad Distrital de Independencia", name: "Mapa de zonas seguras y rutas de evacuación ante aluviones en Huaraz e Independencia (mayo 2025)", url: "https://sinia.minam.gob.pe/mapas/mapa-zonas-seguras-rutas-evacuacion-ante-aluviones-huaraz-independencia", license: "No indicada", type: "oficial" });
    const fIng = await fuente({ institution: "INGEMMET", name: "GEOCATMIN – peligros geológicos y susceptibilidad a movimientos en masa", url: "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services", license: "No indicada (inventario y zonas críticas también en datosabiertos.gob.pe con ODC-BY)", type: "oficial" });
    const fMuni = await fuente({ institution: "Municipalidad Provincial de Huaraz", name: "Plan del Programa Anual de Actividades del Grupo de Trabajo para la GRD, año 2025", url: "https://cdn.www.gob.pe/uploads/document/file/8093943/6631517-resolucion-de-alcaldia-n-59-2025-mph-a-anexo.pdf", license: "Documento público", type: "municipal" });
    const fContra = await fuente({ institution: "Contraloría General de la República", name: "Informe de control concurrente a la obra de la Av. Luzuriaga (difundido el 20-05-2025)", url: "https://ancashaldia.com/huaraz-contraloria-alerto-falta-de-acciones-para-reinicio-de-obras-de-avenida-luzuriaga-en/", license: "Documento público", type: "oficial" });
    const fPrensa = await fuente({ institution: "Prensa (Andina, RSD, Ancash Noticias, Diario de Chimbote, Panamericana, Correo, RPP)", name: "Inundaciones por lluvia reportadas en noticias 2018–2026", url: null, license: "Citas textuales con enlace a cada nota", type: "prensa" });
    const fOsm = await fuente({ institution: "OpenStreetMap", name: "Ríos y quebradas (waterway=river|stream)", url: "https://www.openstreetmap.org", license: "ODbL – © colaboradores de OpenStreetMap", type: "osm" });
    const fCop = await fuente({ institution: "Agencia Espacial Europea (Copernicus)", name: "Modelo digital de elevación Copernicus GLO-30", url: "https://registry.opendata.aws/copernicus-dem/", license: "Copernicus DEM – uso libre con atribución (© DLR e.V. 2010-2014 y © Airbus Defence and Space GmbH 2014-2018, Copernicus)", type: "oficial" });
    const fRecientes = await fuente({ institution: "INDECI, INGEMMET, INAIGEM, municipalidades y prensa (recopilación del proyecto)", name: "Emergencias recientes 2022–2026 en Huaraz e Independencia", url: null, license: "Cada evento cita su fuente con enlace y texto", type: "prensa" });
    const fInei = await fuente({ institution: "INEI", name: "Manzanas censales (ig_manzana) y límites", url: "https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows", license: "No indicada", type: "oficial" });

    // 5) Datasets
    const peligro = proc("zonas_peligro.geojson");
    const dataset = async (v: typeof s.datasets.$inferInsert) => (await tx.insert(s.datasets).values({ retrievedAt: ahora, ...v }).returning())[0].id;
    const dAluvion = await dataset({ sourceId: fMapa, title: "Niveles de peligro por aluvión – zona baja de la subcuenca Quillcay", hazardTypeCode: "aluvion", scale: "1:8 500", sourceDate: "2025-05", method: "Digitalizado por el proyecto desde la imagen oficial georreferenciada con la grilla UTM 18S (±10 m)", coverage: multi(peligro.cobertura), verificationStatus: "pendiente", published: true });
    const dSeguras = await dataset({ sourceId: fMapa, title: "Zonas seguras y puntos de atención ante aluviones", hazardTypeCode: "aluvion", scale: "1:8 500", sourceDate: "2025-05", method: "Íconos digitalizados (punta del pin) y revisados uno a uno", coverage: multi(peligro.cobertura), verificationStatus: "pendiente", published: true });
    const dFlechas = await dataset({ sourceId: fMapa, title: "Flechas de ruta de evacuación ante aluviones", hazardTypeCode: "aluvion", scale: "1:8 500", sourceDate: "2025-05", method: "Detección automática de flechas (~5 % sin detectar)", coverage: multi(peligro.cobertura), verificationStatus: "pendiente", published: true });
    const dIngAreas = await dataset({ sourceId: fIng, title: "Áreas de peligro evaluadas en informes técnicos (A7607, A7375, A7315)", scale: "Local", sourceDate: "2022–2025", method: "Descarga del servicio GEOCATMIN (capa 6)", verificationStatus: "oficial", published: true });
    const dIngPuntos = await dataset({ sourceId: fIng, title: "Inventario de peligros geológicos (puntos)", scale: "Puntual", sourceDate: "2007–2026 (mayormente 2007)", method: "Descarga del servicio GEOCATMIN (capas 0 y 1)", verificationStatus: "oficial", published: true });
    const dIngCrit = await dataset({ sourceId: fIng, title: "Zonas críticas por peligros geológicos", scale: "Puntual", sourceDate: "s/f", method: "Descarga del servicio GEOCATMIN (capa 2)", verificationStatus: "oficial", published: true });
    const dSuscep = await dataset({ sourceId: fIng, title: "Susceptibilidad a movimientos en masa", hazardTypeCode: "deslizamiento", scale: "Regional", sourceDate: "s/f", method: "Descarga del servicio SERV_SUSCEPTIBLE_MOV_MASA_REGIONAL", verificationStatus: "oficial", published: true });
    const dMuni = await dataset({ sourceId: fMuni, title: "Zonas críticas por lluvias intensas e inundación y emergencias SINPAD 2024–2025", hazardTypeCode: "inundacion_pluvial", sourceDate: "2025-04", method: "Sectores ubicados con INEI (centros poblados), OpenStreetMap o el mapa oficial; ubicación aproximada", verificationStatus: "pendiente", published: true });
    const dContra = await dataset({ sourceId: fContra, title: "Av. Luzuriaga: aniegos recurrentes (tramo Raymondi – Pedro Villón)", hazardTypeCode: "inundacion_pluvial", sourceDate: "2025-05", method: "Tramo recortado de OpenStreetMap entre los cruces citados", verificationStatus: "pendiente", published: true });
    const dPrensa = await dataset({ sourceId: fPrensa, title: "Inundaciones por lluvia reportadas en noticias", hazardTypeCode: "inundacion_pluvial", sourceDate: "2018–2026", method: "Notas verificadas con cita textual; lugares ubicados con OpenStreetMap o INEI", verificationStatus: "verificado", published: true });
    const dOsm = await dataset({ sourceId: fOsm, title: "Cauces de ríos y quebradas", hazardTypeCode: "huaico", sourceDate: "2026-11", method: "Overpass API", verificationStatus: "no_verificado", published: true });
    const dPendiente = await dataset({ sourceId: fCop, title: "Pendiente del terreno (Copernicus GLO-30, 30 m)", hazardTypeCode: "deslizamiento", scale: "30 m", sourceDate: "2021 (GLO-30)", method: "scripts/etl/pendiente_copernicus.sh: suavizado 3×3, pendiente en grados, clases del INGEMMET (15°, 25°, 45°). Modelo de superficie: incluye edificios", verificationStatus: "no_verificado", published: true });
    const dCaminos = await dataset({ sourceId: fCop, title: "Caminos aguas abajo de huaicos documentados (según el relieve)", hazardTypeCode: "huaico", scale: "30 m", sourceDate: "2026-11", method: "scripts/etl/huaico_caminos.ts: desde cada huaico ocurrido y zona crítica del INGEMMET, camino de mayor pendiente sobre Copernicus GLO-30 con los cauces de OSM quemados y relleno de depresiones, hasta el río Santa", verificationStatus: "no_verificado", published: true });
    const dAluvionReciente = await dataset({ sourceId: fRecientes, title: "Aluviones recientes por desborde de lagunas glaciares", hazardTypeCode: "aluvion", sourceDate: "2025", method: "Eventos de origen glaciar de la investigación de huaicos (inspección técnica INAIGEM–INGEMMET); mismo punto y recorrido", verificationStatus: "verificado", published: true });
    const dRecientes: Record<string, number> = {};
    for (const p of PELIGROS_RECIENTES)
      dRecientes[p] = await dataset({ sourceId: fRecientes, title: `Eventos recientes de ${NOMBRE_PELIGRO[p]} (2022–2026)`, hazardTypeCode: p, sourceDate: "2022–2026", method: "Recopilación de reportes de INDECI, INGEMMET, INAIGEM, municipalidades y prensa con cita textual; ubicación con INEI, OpenStreetMap o Nominatim", verificationStatus: "verificado", published: true });
    const dManz = await dataset({ sourceId: fInei, title: "Manzanas censales del distrito de Huaraz con nivel de peligro", sourceDate: "Censo INEI", method: "scripts/etl/huaraz_manzanas.py: centroide y vértices cruzados con todas las capas", verificationStatus: "pendiente", published: true });
    suma("datasets", 12);

    // 6) Elementos de peligro
    const filas: (typeof s.hazardFeatures.$inferInsert)[] = [];
    for (const f of peligro.features) {
      const n = f.properties.nivel_peligro as string;
      filas.push({ datasetId: dAluvion, hazardTypeCode: "aluvion", category: "zona_modelada", level: NIVEL_ALUVION[n], levelLabel: ETIQUETA_ALUVION[n], geom: f.geometry, locationConfidence: "alta", properties: { area_aprox_m2: f.properties.area_aprox_m2, escenario: f.properties.escenario } });
    }
    for (const f of proc("ingemmet_cartografia_areas.geojson").features)
      for (const c of categoriasIngemmet(f.properties))
        filas.push({ datasetId: dIngAreas, hazardTypeCode: c, category: "area_evaluada", levelLabel: f.properties.GPELIGRO?.trim() || null, geom: f.geometry, eventDate: f.properties.FECHA_EVAL ?? null, properties: { tipo: f.properties.PELIGRO_ES, sector: f.properties.SECTOR, informe: f.properties.CODIGO, estado: f.properties.EAM?.trim() || null } });
    for (const n of ["ingemmet_inventario_puntos.geojson", "ingemmet_otros_peligros_puntos.geojson"])
      for (const f of proc(n).features)
        for (const c of categoriasIngemmet(f.properties))
          filas.push({ datasetId: dIngPuntos, hazardTypeCode: c, category: "evento_registrado", geom: f.geometry, locationConfidence: "alta", approxRadiusM: 50, eventDate: f.properties.FECHA_TXT ?? null, properties: { tipo: f.properties.NOM_PELIGRO_TXT || f.properties.TIP_PELIGRO_TXT, sector: f.properties.NM_SECTOR ?? null } });
    for (const f of proc("ingemmet_zonas_criticas_puntos.geojson").features)
      for (const c of categoriasIngemmet(f.properties))
        filas.push({ datasetId: dIngCrit, hazardTypeCode: c, category: "zona_critica", geom: f.geometry, locationConfidence: "media", approxRadiusM: 100, properties: { paraje: f.properties.PARAJE, peligros: f.properties.PELIGROS_G, recomendacion: f.properties.RECOMEND?.trim() || null, boletin: f.properties.BOLETIN?.trim() || null } });
    for (const f of proc("ingemmet_susceptibilidad_mov_masa.geojson").features) {
      const v = Number(f.properties.LEYENDA);
      filas.push({ datasetId: dSuscep, hazardTypeCode: "deslizamiento", category: "susceptibilidad", level: v, levelLabel: SUSC_TXT[v], geom: f.geometry });
    }
    for (const f of proc("municipalidad_lluvias_2025.geojson").features) {
      const p = f.properties;
      if (p.tipo === "zona_critica_lluvia" || p.tipo === "zona_critica_lluvia_linea") {
        const linea = p.tipo === "zona_critica_lluvia_linea";
        const base = { datasetId: dMuni, category: "sector_expuesto" as const, geom: f.geometry, locationConfidence: p.confianza_ubicacion, approxRadiusM: linea ? 30 : 200,
          properties: { zona: p.zona, sector: p.sector, poblacion: p.zona_poblacion, viviendas: p.zona_viviendas, iiee: p.zona_iiee, metodo: p.metodo_ubicacion } };
        filas.push({ ...base, hazardTypeCode: "inundacion_pluvial" });
        // La tabla 8 del plan municipal es de zonas críticas por lluvias intensas e inundación: NO se copia a huaico.
        // (Para huaico, el respaldo oficial del Río Seco es la zona crítica del INGEMMET, en su propia ubicación.)
      } else if (p.tipo === "emergencia_sinpad") {
        filas.push({ datasetId: dMuni, hazardTypeCode: "deslizamiento", category: "evento_registrado", geom: f.geometry, locationConfidence: "media", approxRadiusM: 150, eventDate: p.fecha, properties: { sinpad: p.codigo_sinpad, sector: p.sector, descripcion: p.descripcion, metodo: p.metodo_ubicacion } });
      }
    }
    for (const f of proc("aniegos_centro.geojson").features)
      filas.push({ datasetId: dContra, hazardTypeCode: "inundacion_pluvial", category: "aniego_recurrente", geom: f.geometry, approxRadiusM: 20, properties: { lugar: f.properties.lugar, descripcion: f.properties.descripcion } });
    const noticias = JSON.parse(readFileSync(path.join(ROOT, "data/raw/huaraz/noticias_inundaciones.json"), "utf8"));
    for (const l of noticias.lugares)
      filas.push({ datasetId: dPrensa, hazardTypeCode: "inundacion_pluvial", category: "evento_registrado", geom: { type: "Point", coordinates: l.coord }, locationConfidence: l.confianza, approxRadiusM: l.confianza === "alta" ? 60 : 150, eventDate: l.eventos.map((e: any) => e.fecha).sort().at(-1), properties: { lugar: l.lugar, distrito: l.distrito, eventos: l.eventos, metodo: l.metodo } });
    for (const f of proc("osm_cauces.geojson").features)
      filas.push({ datasetId: dOsm, hazardTypeCode: "huaico", category: "cauce", geom: f.geometry, properties: { nombre: f.properties.nombre, tipo: f.properties.tipo, osm_id: f.properties.osm_id } });

    // Caminos aguas abajo (franja de 50 m): conectan cada huaico ocurrido o zona crítica con el río por donde bajaría.
    if (existsSync(path.join(ROOT, "data/processed/huaraz/huaico_caminos.geojson")))
      for (const f of proc("huaico_caminos.geojson").features)
        filas.push({ datasetId: dCaminos, hazardTypeCode: "huaico", category: "camino_aguas_abajo", geom: f.geometry, locationConfidence: "media", approxRadiusM: 50, eventDate: f.properties.fecha_origen ?? null, properties: { origen: f.properties.origen, tipo_origen: f.properties.tipo_origen, longitud_m: f.properties.longitud_m } });

    // Pendiente: cada polígono por separado para que el índice espacial sirva en las consultas de un punto.
    for (const f of proc("pendiente_copernicus.geojson").features)
      for (const coords of f.geometry.coordinates as unknown[])
        filas.push({ datasetId: dPendiente, hazardTypeCode: "deslizamiento", category: "pendiente", level: f.properties.clase, levelLabel: f.properties.etiqueta, geom: { type: "Polygon", coordinates: coords as never }, properties: {} });

    // Eventos recientes (2022–2026) investigados por peligro: data/raw/huaraz/eventos_recientes_<peligro>.json
    type Geometria = { cauces_osm?: number[]; conectores?: [number, number][][]; nota?: string };
    const recorridos: { peligro: string; geometria: Geometria; props: Record<string, unknown>; fecha: string | null }[] = [];
    for (const p of PELIGROS_RECIENTES) {
      const archivo = path.join(ROOT, `data/raw/huaraz/eventos_recientes_${ARCHIVO_PELIGRO[p]}.json`);
      if (!existsSync(archivo)) continue;
      for (const e of JSON.parse(readFileSync(archivo, "utf8")).eventos as any[]) {
        if (!Array.isArray(e.coord)) continue;
        const props = { lugar: e.lugar, distrito: e.distrito, descripcion: e.descripcion, afectacion: e.afectacion ?? null, fuentes: e.fuentes, metodo: e.metodo_ubicacion, recorrido: e.recorrido ?? null };
        // Huaico: solo se marca un área donde pasó con ubicación precisa; si solo se conoce el barrio o el caserío,
        // queda como punto (sin radio) para no pintar de rojo lugares por donde no pasó.
        const radio = p === "huaico" && e.confianza !== "alta" ? null : (RADIO_CONFIANZA[e.confianza as "alta" | "media" | "baja"] ?? 150);
        filas.push({ datasetId: dRecientes[p], hazardTypeCode: p, category: "evento_registrado", geom: { type: "Point", coordinates: e.coord }, locationConfidence: e.confianza, approxRadiusM: radio, eventDate: e.fecha, properties: props });
        if (e.geometria_recorrido) recorridos.push({ peligro: p, geometria: e.geometria_recorrido, props, fecha: e.fecha });
        // Un flujo por desborde de laguna glaciar es también un aluvión: se muestra en los dos modos.
        if (e.origen_glaciar) {
          filas.push({ datasetId: dAluvionReciente, hazardTypeCode: "aluvion", category: "evento_registrado", level: 4, geom: { type: "Point", coordinates: e.coord }, locationConfidence: e.confianza, approxRadiusM: null, eventDate: e.fecha, properties: props });
          if (e.geometria_recorrido) recorridos.push({ peligro: "aluvion", geometria: e.geometria_recorrido, props, fecha: e.fecha });
          suma("aluviones_recientes", 1);
        }
        suma(`eventos_recientes_${p}`, 1);
      }
    }

    await enLotes(filas, 200, (lote) => tx.insert(s.hazardFeatures).values(lote));

    // Recorrido de un flujo ya ocurrido: franja de 50 m a cada lado de los cauces que indica el evento
    // (ids de OpenStreetMap revisados a mano) más los tramos que OSM no tiene, trazados en línea recta.
    for (const r of recorridos) {
      const g = r.geometria;
      if (!g) continue;
      const lineas = (g.conectores ?? []).map((c) => JSON.stringify({ type: "LineString", coordinates: c }));
      const res = await tx.execute(sql`
        INSERT INTO hazard_features (dataset_id, hazard_type_code, category, level, level_label, geom, location_confidence, event_date, properties)
        SELECT ${r.peligro === "aluvion" ? dAluvionReciente : dRecientes[r.peligro]}, ${r.peligro}, 'evento_registrado', 4, 'Recorrido de un flujo ya ocurrido',
               ST_Multi(ST_Union(ST_Buffer(t.geom::geography, 50)::geometry)), 'media', ${r.fecha},
               ${JSON.stringify({ ...r.props, es_recorrido: true, nota_recorrido: g.nota ?? null })}::jsonb
        FROM (
          SELECT geom FROM hazard_features WHERE category = 'cauce' AND (properties->>'osm_id')::bigint = ANY(${sql.raw(`ARRAY[${(g.cauces_osm ?? []).map(Number).join(",") || "NULL"}]::bigint[]`)})
          UNION ALL
          SELECT ST_SetSRID(ST_GeomFromGeoJSON(x), 4326) FROM unnest(${sql.raw(`ARRAY[${lineas.map((l) => `'${l.replace(/'/g, "''")}'`).join(",") || "NULL"}]::text[]`)}) x WHERE x IS NOT NULL
        ) t
        HAVING count(*) > 0
        RETURNING id`);
      suma("recorridos_de_flujo", res.length);
    }
    // Repetidos: si un evento del inventario coincide (mismo peligro, ≤ 50 m) con un evento reciente investigado,
    // queda solo el reciente, que trae la fecha real del evento y fuentes con cita (el inventario a veces trae la fecha
    // de registro, p. ej. Ichoca: 28-03-2025 en el inventario, 25-12-2023 el huaico).
    const repetidos = await tx.execute(sql`
      DELETE FROM hazard_features viejo
      USING hazard_features nuevo
      WHERE viejo.category = 'evento_registrado' AND nuevo.category = 'evento_registrado'
        AND viejo.hazard_type_code = nuevo.hazard_type_code
        -- Solo el inventario del INGEMMET (trae fechas de registro). Las noticias nunca se borran: un punto cercano
        -- puede ser otra inundación en otra fecha (p. ej. Av. Luzuriaga 2021 y 2023 frente a la de 2025).
        AND viejo.dataset_id IN (SELECT id FROM datasets WHERE title = 'Inventario de peligros geológicos (puntos)')
        AND nuevo.dataset_id IN (SELECT id FROM datasets WHERE title LIKE 'Eventos recientes de %')
        AND GeometryType(viejo.geom) = 'POINT' AND GeometryType(nuevo.geom) = 'POINT'
        AND ST_DWithin(viejo.geom::geography, nuevo.geom::geography, 50)
      RETURNING viejo.id`);
    suma("eventos_repetidos_quitados", repetidos.length);

    // Algunas geometrías de origen (p. ej. susceptibilidad del INGEMMET) se autointersecan:
    // se reparan para que las consultas espaciales no fallen, conservando su dimensión.
    const reparadas = await tx.execute(sql`UPDATE hazard_features
      SET geom = ST_CollectionExtract(ST_MakeValid(geom), ST_Dimension(geom) + 1)
      WHERE NOT ST_IsValid(geom) RETURNING id`);
    suma("geometrias_reparadas", reparadas.length);
    await tx.execute(sql`UPDATE hazard_features hf SET ubigeo = tu.ubigeo FROM territorial_units tu
      WHERE tu.level = 'distrito' AND ST_Intersects(tu.geom, ST_PointOnSurface(hf.geom))`);
    suma("hazard_features", filas.length);

    // 7) Zonas seguras y flechas
    for (const f of proc("zonas_seguras.geojson").features) {
      const p = f.properties;
      const [z] = await tx.insert(s.safeZones).values({ datasetId: dSeguras, type: p.tipo, name: p.nombre ?? null, reference: p.referencia, geom: f.geometry as never, precisionM: p.precision_aprox_m, verificationStatus: "pendiente", notes: p.observaciones ?? null }).returning();
      await tx.insert(s.safeZoneHazards).values({ safeZoneId: z.id, hazardTypeCode: "aluvion" });
      suma("safe_zones", 1);
    }
    const flechas = proc("flechas_evacuacion.geojson").features.map((f) => ({ datasetId: dFlechas, hazardTypeCode: "aluvion", bearingDeg: Math.round(f.properties.rumbo_grados) % 360, geom: f.geometry as never, confidence: String(f.properties.confianza) }));
    await enLotes(flechas, 200, (lote) => tx.insert(s.evacuationArrows).values(lote));
    suma("evacuation_arrows", flechas.length);
    await tx.execute(sql`UPDATE safe_zones sz SET ubigeo = tu.ubigeo FROM territorial_units tu WHERE tu.level = 'distrito' AND ST_Contains(tu.geom, sz.geom)`);

    // 8) Manzanas y su nivel por peligro
    const manz = proc("manzanas_peligro.geojson").features;
    await enLotes(manz, 200, (lote) => tx.insert(s.cityBlocks).values(lote.map((f) => ({ id: f.properties.id, ubigeo: "020101", zone: f.properties.zona, block: f.properties.manzana, populatedPlaceCode: f.properties.ccpp, geom: multi(f.geometry) }))));
    suma("city_blocks", manz.length);

    // Nivel de cada manzana con LA MISMA regla que la tarjeta (nivelElemento de src/features/riesgo/veredicto.ts):
    // así el mapa y la tarjeta nunca se contradicen. (Antes había tres reglas: el ETL de Python, SQL aquí y la tarjeta.)
    const niveles = await nivelesDeManzanas(tx);
    await enLotes(niveles, 500, (lote) => tx.insert(s.cityBlockHazards).values(lote));
    suma("city_block_hazards", niveles.length);
    void dManz;

    // 9) Calles para rutas a pie: cada tramo recto con su largo y si cruza una zona de peligro.
    //    Peligroso = donde la app marca nivel ≥ 2 (aluvión: zonas medio a muy alto y aluviones ocurridos;
    //    huaico: ya bajó, zona crítica o camino aguas abajo; inundación: aniegos, inundaciones con ubicación y sectores).
    if (existsSync(path.join(ROOT, "data/processed/huaraz/osm_calles.geojson"))) {
      const calles = proc("osm_calles.geojson").features.map((f) => ({ osmId: f.properties.osm_id, name: f.properties.nombre ?? null, highway: f.properties.tipo, geom: f.geometry }));
      await enLotes(calles, 300, (lote) => tx.insert(s.streets).values(lote as never));
      await tx.execute(sql`
        INSERT INTO street_segments (street_id, seq, length_m, geom)
        SELECT st.id, d.path[1], ST_Length(d.geom::geography), d.geom
        FROM streets st, ST_DumpSegments(st.geom) d
        WHERE ST_Length(d.geom::geography) > 0`);
      const peligroso = (peligro: string, categorias: string) => sql`
        EXISTS (SELECT 1 FROM hazard_features hf
                WHERE hf.hazard_type_code = ${peligro} AND hf.category::text = ANY(${sql.raw(`ARRAY[${categorias}]`)})
                  AND (GeometryType(hf.geom) <> 'POINT' OR coalesce(hf.approx_radius_m, 0) > 0)
                  AND ST_DWithin(hf.geom, sg.geom, 0.003)
                  AND ST_DWithin(hf.geom::geography, sg.geom::geography, coalesce(hf.approx_radius_m, 0))
                  AND (hf.category <> 'zona_modelada' OR hf.level >= 2)
                  AND (hf.category <> 'sector_expuesto' OR hf.location_confidence <> 'baja'))`;
      await tx.execute(sql`UPDATE street_segments sg SET
        hazard_aluvion = ${peligroso("aluvion", "'zona_modelada','evento_registrado'")},
        hazard_huaico = ${peligroso("huaico", "'area_evaluada','evento_registrado','zona_critica','camino_aguas_abajo'")},
        hazard_inundacion = ${peligroso("inundacion_pluvial", "'aniego_recurrente','evento_registrado','sector_expuesto'")}`);
      suma("calles", calles.length);
    }

    // 10) Centros de salud (RENIPRESS de SUSALUD + OpenStreetMap)
    const archivoSalud = path.join(ROOT, "data/raw/huaraz/establecimientos_salud.json");
    if (existsSync(archivoSalud)) {
      const est = JSON.parse(readFileSync(archivoSalud, "utf8")).establecimientos as any[];
      const filasSalud = est.filter((e) => Array.isArray(e.coord)).map((e) => ({
        renipressCode: e.codigo_renipress ?? null, name: nombrePropio(e.nombre), type: e.tipo, category: e.categoria ?? null, institution: e.institucion ?? null,
        district: e.distrito ?? null, address: e.direccion ?? null, phone: telefonosLegibles(e.telefono).join(" / ") || null, schedule: e.horario ?? null,
        emergency24h: e.emergencia_24h ?? null, locationMethod: e.metodo_ubicacion ?? null, locationConfidence: e.confianza ?? "media",
        geom: { type: "Point", coordinates: e.coord },
      }));
      await enLotes(filasSalud, 200, (lote) => tx.insert(s.healthFacilities).values(lote as never));
      suma("centros_de_salud", filasSalud.length);
    }

    // 11) Lugares para el buscador: centros poblados del INEI y nombres de OpenStreetMap
    const lugares = [
      ...JSON.parse(readFileSync(path.join(ROOT, "data/raw/inei/huaraz_centros_poblados_inei.geojson"), "utf8")).features.map((f: any) => ({
        name: titulo(f.properties.nombccpp), kind: "centro_poblado", district: titulo(f.properties.nombdist), source: "INEI", geom: puntoDe(f.geometry),
      })),
      ...proc("osm_lugares.geojson").features.map((f) => ({
        name: f.properties.nombre as string, kind: f.properties.tipo as string, district: null, source: "OpenStreetMap", geom: f.geometry,
      })),
    ].map((l) => ({ ...l, nameNorm: normalizar(l.name) }));
    await enLotes(lugares, 300, (lote) => tx.insert(s.places).values(lote as never));
    await tx.execute(sql`UPDATE places p SET district = initcap(lower(tu.name)) FROM territorial_units tu
      WHERE p.district IS NULL AND tu.level = 'distrito' AND ST_Contains(tu.geom, p.geom)`);
    suma("places", lugares.length);
  });

  console.log("Carga completa:");
  for (const [k, v] of Object.entries(conteo)) console.log(`  ${k.padEnd(20)} ${v}`);
  await client.end();
}

/** Etiqueta corta para el detalle de una manzana. */
const ETIQUETA: Record<string, string> = {
  zona_modelada: "Zona del mapa oficial de aluvión",
  area_evaluada: "Área evaluada por el INGEMMET",
  evento_registrado: "Evento ya ocurrido",
  zona_critica: "Zona crítica del INGEMMET",
  susceptibilidad: "Susceptibilidad del terreno (INGEMMET)",
  sector_expuesto: "Zona crítica señalada por la Municipalidad",
  aniego_recurrente: "Aniegos recurrentes (Contraloría)",
  camino_aguas_abajo: "Camino aguas abajo de un huaico documentado",
};

/**
 * Para cada manzana y peligro: el nivel más alto de los elementos que la tocan, con la regla de la tarjeta.
 * - "Dentro": un área o línea a ≤ su radio aproximado; un punto solo si tiene radio (sin radio = ubicación de barrio o
 *   caserío: no colorea manzanas).
 * - Aluvión: -1 si la manzana está en la cobertura del mapa oficial y fuera de sus zonas.
 * - Otros (no aluvión ni huaico): "registrado cerca" (1) si un evento queda a ≤ 150 m, igual que la tarjeta.
 */
async function nivelesDeManzanas(tx: any) {
  const filas = (await tx.execute(sql`
    SELECT b.id AS manzana, hf.hazard_type_code AS peligro, hf.category AS categoria, hf.level AS nivel,
           hf.location_confidence AS confianza,
           ST_DWithin(hf.geom::geography, b.geom::geography, coalesce(hf.approx_radius_m, 0))
             AND (GeometryType(hf.geom) <> 'POINT' OR coalesce(hf.approx_radius_m, 0) > 0) AS dentro
    FROM city_blocks b JOIN hazard_features hf
      ON ST_DWithin(hf.geom, b.geom, 0.004)
     AND ST_DWithin(hf.geom::geography, b.geom::geography, coalesce(hf.approx_radius_m, 0) + ${RADIO_CERCA_M})
    WHERE hf.category NOT IN ('cauce', 'pendiente')`)) as { manzana: string; peligro: Peligro; categoria: Hallazgo["categoria"]; nivel: number | null; confianza: Hallazgo["confianza"]; dentro: boolean }[];
  const cobertura = new Set(
    ((await tx.execute(sql`
      SELECT b.id FROM city_blocks b JOIN datasets d ON d.hazard_type_code = 'aluvion' AND d.coverage IS NOT NULL AND ST_Intersects(d.coverage, b.geom)`)) as { id: string }[]).map((r) => r.id),
  );
  const ids = ((await tx.execute(sql`SELECT id FROM city_blocks`)) as { id: string }[]).map((r) => r.id);

  const porClave = new Map<string, typeof filas>();
  for (const f of filas) {
    const k = `${f.manzana}|${f.peligro}`;
    (porClave.get(k) ?? porClave.set(k, []).get(k)!).push(f);
  }
  const salida: { blockId: string; hazardTypeCode: string; level: number; details: string[] }[] = [];
  for (const id of ids)
    for (const p of PELIGROS) {
      const fs = porClave.get(`${id}|${p}`) ?? [];
      let nivel = 0;
      const detalle = new Set<string>();
      for (const f of fs.filter((x) => x.dentro)) {
        const n = nivelElemento({ peligro: p, categoria: f.categoria, nivel: f.nivel, confianza: f.confianza });
        if (n > 0) detalle.add(ETIQUETA[f.categoria] ?? f.categoria);
        if (n > nivel || (nivel === 0 && n === -1)) nivel = n;
      }
      if (nivel === 0 && p === "aluvion" && cobertura.has(id)) nivel = -1;
      if (nivel <= 0 && p !== "aluvion" && p !== "huaico" && fs.some((x) => !x.dentro && CATEGORIAS_CERCA.includes(x.categoria))) {
        nivel = 1;
        detalle.add("Evento registrado a menos de 150 m");
      }
      salida.push({ blockId: id, hazardTypeCode: p, level: nivel, details: [...detalle] });
    }
  return salida;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
