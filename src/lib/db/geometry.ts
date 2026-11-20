/**
 * Columnas PostGIS para Drizzle.
 *
 * - Escritura: se recibe GeoJSON y se convierte en SQL con ST_GeomFromGeoJSON (SRID 4326).
 * - Lectura: PostGIS devuelve EWKB en hexadecimal; se convierte a GeoJSON con `ewkbToGeoJSON`.
 *
 * Así el resto de la app trabaja siempre con GeoJSON (el formato que usa MapLibre).
 */
import { customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type Position = [number, number];
export type Point = { type: "Point"; coordinates: Position };
export type LineString = { type: "LineString"; coordinates: Position[] };
export type Polygon = { type: "Polygon"; coordinates: Position[][] };
export type MultiPoint = { type: "MultiPoint"; coordinates: Position[] };
export type MultiLineString = { type: "MultiLineString"; coordinates: Position[][] };
export type MultiPolygon = { type: "MultiPolygon"; coordinates: Position[][][] };
export type Geometry = Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon;

type GeometryKind = "Geometry" | Geometry["type"];

/**
 * Columna `geometry(<tipo>, 4326)`.
 * @example location: geometryColumn("location", "Point")
 */
export function geometryColumn<K extends GeometryKind = "Geometry">(name: string, kind?: K) {
  return customType<{
    data: K extends "Geometry" ? Geometry : Extract<Geometry, { type: K }>;
    driverData: string;
  }>({
    dataType() {
      return `geometry(${kind ?? "Geometry"}, 4326)`;
    },
    toDriver(value) {
      return sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(value)}), 4326)`;
    },
    fromDriver(value) {
      return ewkbToGeoJSON(value) as never;
    },
  })(name);
}

// --- Lector de EWKB (hexadecimal) ------------------------------------------------

const WKB_TYPES: Record<number, Geometry["type"]> = {
  1: "Point",
  2: "LineString",
  3: "Polygon",
  4: "MultiPoint",
  5: "MultiLineString",
  6: "MultiPolygon",
};
const SRID_FLAG = 0x20000000;
const Z_FLAG = 0x80000000;
const M_FLAG = 0x40000000;

class Reader {
  private view: DataView;
  private offset = 0;
  private little = true;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  byteOrder() {
    this.little = this.view.getUint8(this.offset) === 1;
    this.offset += 1;
  }
  uint32() {
    const v = this.view.getUint32(this.offset, this.little);
    this.offset += 4;
    return v;
  }
  float64() {
    const v = this.view.getFloat64(this.offset, this.little);
    this.offset += 8;
    return v;
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error("EWKB inválido: no es hexadecimal");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function readGeometry(r: Reader): Geometry {
  r.byteOrder();
  const raw = r.uint32();
  const hasZ = (raw & Z_FLAG) !== 0;
  const hasM = (raw & M_FLAG) !== 0;
  if (raw & SRID_FLAG) r.uint32(); // SRID: siempre 4326 en este proyecto
  const code = raw & 0x0fffffff;
  const type = WKB_TYPES[code];
  if (!type) throw new Error(`Tipo WKB no soportado: ${code}`);

  const position = (): Position => {
    const x = r.float64();
    const y = r.float64();
    if (hasZ) r.float64();
    if (hasM) r.float64();
    return [x, y];
  };
  const positions = () => Array.from({ length: r.uint32() }, position);
  const rings = () => Array.from({ length: r.uint32() }, positions);
  const parts = <G extends Geometry>() => Array.from({ length: r.uint32() }, () => readGeometry(r) as G);

  switch (type) {
    case "Point":
      return { type, coordinates: position() };
    case "LineString":
      return { type, coordinates: positions() };
    case "Polygon":
      return { type, coordinates: rings() };
    case "MultiPoint":
      return { type, coordinates: parts<Point>().map((g) => g.coordinates) };
    case "MultiLineString":
      return { type, coordinates: parts<LineString>().map((g) => g.coordinates) };
    case "MultiPolygon":
      return { type, coordinates: parts<Polygon>().map((g) => g.coordinates) };
  }
}

/** Convierte EWKB/WKB hexadecimal (formato de salida de PostGIS) a GeoJSON. */
export function ewkbToGeoJSON(hex: string): Geometry {
  return readGeometry(new Reader(hexToBytes(hex)));
}
