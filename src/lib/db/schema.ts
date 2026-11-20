/**
 * Esquema de la base de datos (PostgreSQL + PostGIS, SRID 4326).
 *
 * Principio: toda información de peligro pertenece a un `dataset`, y todo dataset tiene
 * fuente, fecha, escala, método y cobertura. Así la app puede distinguir "sin peligro
 * identificado" (dentro de la cobertura) de "sin información" (fuera de ella).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { geometryColumn } from "./geometry";

// --- Enumeraciones ---------------------------------------------------------------

export const territorialLevel = pgEnum("territorial_level", ["departamento", "provincia", "distrito"]);

export const sourceType = pgEnum("source_type", [
  "oficial", // ministerios, organismos técnicos (INGEMMET, INAIGEM, ANA, INEI…)
  "municipal",
  "academico",
  "prensa",
  "comunitario", // reportes ciudadanos verificados
  "osm", // OpenStreetMap (ODbL)
  "demo", // datos ficticios de prueba: nunca en producción
]);

export const verificationStatus = pgEnum("verification_status", [
  "oficial", // publicado tal cual por la fuente oficial
  "verificado", // revisado por una persona del proyecto
  "pendiente", // pendiente de revisión humana
  "no_verificado",
]);

export const locationConfidence = pgEnum("location_confidence", ["alta", "media", "baja"]);

export const featureCategory = pgEnum("feature_category", [
  "zona_modelada", // área de un modelo oficial (p. ej. aluvión INAIGEM)
  "area_evaluada", // área medida en un informe técnico
  "evento_registrado", // algo que ya ocurrió (inventario, noticia, SINPAD)
  "zona_critica",
  "susceptibilidad", // escala regional
  "sector_expuesto", // sector nombrado por una autoridad, ubicación aproximada
  "aniego_recurrente",
  "faja_marginal",
  "cauce",
  "pendiente", // pendiente del terreno (clase 1..3) calculada de un modelo de elevación
  "zona_inicio", // (en desuso) estimación descartada de zonas de inicio de huaicos
  "camino_aguas_abajo", // por dónde bajaría el lodo desde un huaico ocurrido o una zona crítica (según el relieve)
]);

export const safeZoneType = pgEnum("safe_zone_type", [
  "zona_seguridad",
  "refugio_temporal",
  "centro_acopio",
  "atencion_medica",
  "puesto_comando",
  "atencion_animal",
  "gestion_cadaveres",
]);

// --- Territorio --------------------------------------------------------------------

export const territorialUnits = pgTable(
  "territorial_units",
  {
    ubigeo: varchar("ubigeo", { length: 6 }).primaryKey(), // código INEI
    name: text("name").notNull(),
    level: territorialLevel("level").notNull(),
    parentUbigeo: varchar("parent_ubigeo", { length: 6 }),
    geom: geometryColumn("geom", "MultiPolygon"),
    geomSimplified: geometryColumn("geom_simplified", "MultiPolygon"),
  },
  (t) => [index("territorial_units_geom_gist").using("gist", t.geom), index("territorial_units_parent_idx").on(t.parentUbigeo)],
);

// --- Fuentes y datasets -----------------------------------------------------------

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  institution: text("institution").notNull(),
  name: text("name").notNull(),
  url: text("url"),
  license: text("license"), // "No indicada" si la fuente no la declara
  type: sourceType("type").notNull(),
});

export const hazardTypes = pgTable("hazard_types", {
  code: varchar("code", { length: 32 }).primaryKey(), // aluvion, inundacion_pluvial, huaico, deslizamiento, caida, erosion…
  name: text("name").notNull(),
  description: text("description"),
});

export const datasets = pgTable(
  "datasets",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => dataSources.id),
    title: text("title").notNull(),
    hazardTypeCode: varchar("hazard_type_code", { length: 32 }).references(() => hazardTypes.code),
    scale: text("scale"), // p. ej. "1:8 500", "regional"
    sourceDate: text("source_date"), // fecha de la fuente tal como se conoce ("2025-05", "2007-02-05")
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }), // fecha de descarga o digitalización
    method: text("method"), // cómo se obtuvo (descarga, digitalización, geocodificación…)
    coverage: geometryColumn("coverage", "MultiPolygon"), // dónde el dataset tiene información
    verificationStatus: verificationStatus("verification_status").notNull().default("pendiente"),
    isDemo: boolean("is_demo").notNull().default(false),
    published: boolean("published").notNull().default(false),
    notes: text("notes"),
  },
  (t) => [index("datasets_coverage_gist").using("gist", t.coverage)],
);

// --- Peligros -----------------------------------------------------------------------

export const hazardFeatures = pgTable(
  "hazard_features",
  {
    id: serial("id").primaryKey(),
    datasetId: integer("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    hazardTypeCode: varchar("hazard_type_code", { length: 32 })
      .notNull()
      .references(() => hazardTypes.code),
    category: featureCategory("category").notNull(),
    level: smallint("level"), // 1 = bajo … 4/5 = muy alto (según la escala del dataset)
    levelLabel: text("level_label"), // texto de la fuente ("Muy alto", "Alta"…)
    geom: geometryColumn("geom").notNull(),
    locationConfidence: locationConfidence("location_confidence").notNull().default("alta"),
    approxRadiusM: integer("approx_radius_m"), // si la ubicación es un punto aproximado
    eventDate: text("event_date"),
    ubigeo: varchar("ubigeo", { length: 6 }).references(() => territorialUnits.ubigeo),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index("hazard_features_geom_gist").using("gist", t.geom),
    index("hazard_features_type_idx").on(t.hazardTypeCode, t.category),
    check("hazard_features_level_range", sql`${t.level} IS NULL OR ${t.level} BETWEEN 1 AND 5`),
  ],
);

// --- Zonas seguras y evacuación ----------------------------------------------------

export const safeZones = pgTable(
  "safe_zones",
  {
    id: serial("id").primaryKey(),
    datasetId: integer("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    type: safeZoneType("type").notNull(),
    name: text("name"),
    reference: text("reference"), // calle o sector cercano si no tiene nombre
    geom: geometryColumn("geom", "Point").notNull(),
    precisionM: integer("precision_m"),
    verificationStatus: verificationStatus("verification_status").notNull().default("pendiente"),
    ubigeo: varchar("ubigeo", { length: 6 }).references(() => territorialUnits.ubigeo),
    notes: text("notes"),
  },
  (t) => [index("safe_zones_geom_gist").using("gist", t.geom)],
);

/** Una zona segura lo es frente a peligros concretos (p. ej. aluvión, no necesariamente sismo). */
export const safeZoneHazards = pgTable(
  "safe_zone_hazards",
  {
    safeZoneId: integer("safe_zone_id")
      .notNull()
      .references(() => safeZones.id, { onDelete: "cascade" }),
    hazardTypeCode: varchar("hazard_type_code", { length: 32 })
      .notNull()
      .references(() => hazardTypes.code),
  },
  (t) => [primaryKey({ columns: [t.safeZoneId, t.hazardTypeCode] })],
);

export const evacuationArrows = pgTable(
  "evacuation_arrows",
  {
    id: serial("id").primaryKey(),
    datasetId: integer("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    hazardTypeCode: varchar("hazard_type_code", { length: 32 })
      .notNull()
      .references(() => hazardTypes.code),
    bearingDeg: smallint("bearing_deg").notNull(), // 0 = norte, sentido horario
    geom: geometryColumn("geom", "Point").notNull(),
    confidence: text("confidence"),
    verificationStatus: verificationStatus("verification_status").notNull().default("pendiente"),
  },
  (t) => [
    index("evacuation_arrows_geom_gist").using("gist", t.geom),
    check("evacuation_arrows_bearing_range", sql`${t.bearingDeg} BETWEEN 0 AND 359`),
  ],
);

// --- Manzanas (cuadras) ------------------------------------------------------------

export const cityBlocks = pgTable(
  "city_blocks",
  {
    id: varchar("id", { length: 20 }).primaryKey(), // idmanzana del INEI
    ubigeo: varchar("ubigeo", { length: 6 })
      .notNull()
      .references(() => territorialUnits.ubigeo),
    zone: varchar("zone", { length: 8 }).notNull(), // zona censal
    block: varchar("block", { length: 8 }).notNull(), // número de manzana
    populatedPlaceCode: varchar("populated_place_code", { length: 8 }),
    geom: geometryColumn("geom", "MultiPolygon").notNull(),
  },
  (t) => [index("city_blocks_geom_gist").using("gist", t.geom), index("city_blocks_ubigeo_idx").on(t.ubigeo)],
);

/** Nivel de cada peligro por manzana: -1 = evaluada sin peligro identificado, 0 = sin información, 1..4. */
export const cityBlockHazards = pgTable(
  "city_block_hazards",
  {
    blockId: varchar("block_id", { length: 20 })
      .notNull()
      .references(() => cityBlocks.id, { onDelete: "cascade" }),
    hazardTypeCode: varchar("hazard_type_code", { length: 32 })
      .notNull()
      .references(() => hazardTypes.code),
    level: smallint("level").notNull(),
    details: jsonb("details").$type<string[]>().notNull().default([]),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockId, t.hazardTypeCode] }),
    check("city_block_hazards_level_range", sql`${t.level} BETWEEN -1 AND 4`),
  ],
);

// --- Lugares para el buscador -----------------------------------------------------

/** Nombres de barrios, centros poblados y calles para buscar un lugar sin depender de servicios externos. */
export const places = pgTable(
  "places",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    nameNorm: text("name_norm").notNull(), // minúsculas y sin tildes, para buscar
    kind: varchar("kind", { length: 24 }).notNull(), // centro_poblado | barrio | calle | lugar
    district: text("district"),
    source: varchar("source", { length: 40 }).notNull(), // INEI | OpenStreetMap
    geom: geometryColumn("geom", "Point").notNull(),
  },
  (t) => [index("places_geom_gist").using("gist", t.geom)],
);

// --- Calles para rutas a pie --------------------------------------------------------

/** Vías caminables de OpenStreetMap (para calcular rutas a pie hacia lugares seguros y centros de salud). */
export const streets = pgTable(
  "streets",
  {
    id: serial("id").primaryKey(),
    osmId: bigint("osm_id", { mode: "number" }).notNull(),
    name: text("name"),
    highway: varchar("highway", { length: 32 }).notNull(),
    geom: geometryColumn("geom", "LineString").notNull(),
  },
  (t) => [index("streets_geom_gist").using("gist", t.geom)],
);

/**
 * Cada tramo recto de una calle, con su largo y si cruza una zona de peligro (por peligro).
 * Se genera en el cargador a partir de `streets` y `hazard_features`; la ruta evita los tramos peligrosos.
 */
export const streetSegments = pgTable(
  "street_segments",
  {
    id: serial("id").primaryKey(),
    streetId: integer("street_id")
      .notNull()
      .references(() => streets.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    lengthM: doublePrecision("length_m").notNull(),
    hazardAluvion: boolean("hazard_aluvion").notNull().default(false),
    hazardHuaico: boolean("hazard_huaico").notNull().default(false),
    hazardInundacion: boolean("hazard_inundacion").notNull().default(false),
    geom: geometryColumn("geom", "LineString").notNull(),
  },
  (t) => [index("street_segments_geom_gist").using("gist", t.geom)],
);

// --- Centros de salud --------------------------------------------------------------

/** Establecimientos de salud (registro RENIPRESS de SUSALUD, completado con OpenStreetMap). */
export const healthFacilities = pgTable(
  "health_facilities",
  {
    id: serial("id").primaryKey(),
    renipressCode: varchar("renipress_code", { length: 20 }),
    name: text("name").notNull(),
    type: varchar("type", { length: 24 }).notNull(), // hospital | centro_salud | puesto_salud | clinica | otro
    category: varchar("category", { length: 8 }),
    institution: text("institution"),
    district: text("district"),
    address: text("address"),
    phone: text("phone"),
    schedule: text("schedule"),
    emergency24h: boolean("emergency_24h"),
    locationMethod: text("location_method"),
    locationConfidence: locationConfidence("location_confidence").notNull().default("media"),
    geom: geometryColumn("geom", "Point").notNull(),
  },
  (t) => [index("health_facilities_geom_gist").using("gist", t.geom)],
);
