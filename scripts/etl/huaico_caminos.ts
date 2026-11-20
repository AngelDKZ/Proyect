/**
 * Caminos aguas abajo de los huaicos documentados (según el relieve).
 *
 * Desde cada huaico que ya ocurrió y cada zona crítica por huaico del INGEMMET, se sigue la dirección de
 * mayor pendiente del modelo de elevación Copernicus GLO-30 (30 m) hasta llegar al río Santa. Así toda zona
 * propensa queda conectada con el cauce por el que bajaría el lodo, aunque OpenStreetMap no tenga esa quebrada.
 * No predice dónde nacen huaicos nuevos: solo sigue el agua cuesta abajo desde donde ya hay evidencia.
 *
 * Método: los ríos y quebradas de OpenStreetMap se "queman" en el relieve (se bajan 30 m) para que el agua los siga;
 * relleno de depresiones "priority-flood" con épsilon (Barnes et al., 2014) para que no se atasque en hoyos del
 * modelo; dirección D8 de mayor pendiente y corte al entrar a 60 m del río Santa.
 *
 * Requiere la base local cargada (`npm run db:cargar`) y el contenedor mapa-riesgo-db.
 * Uso: npx tsx scripts/etl/huaico_caminos.ts
 * Salida: data/processed/huaraz/huaico_caminos.geojson
 */
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

process.loadEnvFile?.(".env");
const ROOT = process.cwd(); // se ejecuta desde la raíz del proyecto
const TILE = "Copernicus_DSM_COG_10_S10_00_W078_00_DEM";
const RAW = path.join(ROOT, `data/raw/copernicus/${TILE}.tif`);
const SALIDA = path.join(ROOT, "data/processed/huaraz/huaico_caminos.geojson");
const ZONA = [-77.62, -9.62, -77.35, -9.4]; // misma zona que la pendiente

function sh(cmd: string) {
  execSync(cmd, { stdio: "inherit", cwd: ROOT });
}

/** Montículo binario mínimo de celdas por altura (para priority-flood). */
class Monticulo {
  private idx: number[] = [];
  constructor(private alt: Float64Array) {}
  get size() {
    return this.idx.length;
  }
  push(i: number) {
    const a = this.idx;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.alt[a[p]] <= this.alt[a[k]]) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop(): number {
    const a = this.idx;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && this.alt[a[l]] < this.alt[a[m]]) m = l;
        if (r < a.length && this.alt[a[r]] < this.alt[a[m]]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top;
  }
}

async function main() {
  if (!existsSync(RAW)) throw new Error(`Falta ${RAW}: ejecutar antes scripts/etl/pendiente_copernicus.sh`);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

  // 1) Modelo de elevación en UTM 18S, recortado a la zona.
  sh(`docker cp "${RAW}" mapa-riesgo-db:/tmp/dem.tif`);
  await sql`CREATE EXTENSION IF NOT EXISTS postgis_raster`;
  await sql`DROP SCHEMA IF EXISTS etl_caminos CASCADE`;
  await sql`CREATE SCHEMA etl_caminos`;
  sh(`docker exec mapa-riesgo-db sh -c "raster2pgsql -q -s 4326 -t 256x256 /tmp/dem.tif etl_caminos.dem | psql -U mapa -d mapa_riesgo -q -v ON_ERROR_STOP=1"`);
  await sql.unsafe(`
    CREATE TABLE etl_caminos.utm AS
    SELECT ST_Transform(ST_Union(ST_Clip(rast, z)), 32718, 30::float8, 30::float8, 'Bilinear') AS rast
    FROM etl_caminos.dem, (SELECT ST_MakeEnvelope(${ZONA.join(",")}, 4326) z) e
    WHERE ST_Intersects(rast, z)`);
  const [meta] = await sql<{ x0: number; y0: number; sx: number; sy: number; w: number; h: number }[]>`
    SELECT ST_UpperLeftX(rast) x0, ST_UpperLeftY(rast) y0, ST_ScaleX(rast) sx, ST_ScaleY(rast) sy, ST_Width(rast) w, ST_Height(rast) h
    FROM etl_caminos.utm`;
  const [{ v }] = await sql<{ v: (number | null)[][] }[]>`SELECT (ST_DumpValues(rast, 1)) v FROM etl_caminos.utm`;
  const { w, h } = meta;
  const z = new Float64Array(w * h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) z[r * w + c] = v[r][c] ?? Number.NaN;
  console.log(`relieve: ${w} × ${h} celdas de 30 m`);

  // 1b) "Quemar" los cauces conocidos (OpenStreetMap): bajar 30 m las celdas por donde pasan. En el fondo del valle
  // el modelo de superficie tiene edificios y árboles que forman hoyos; sin esto el camino cruzaría zonas planas
  // artificiales en vez de seguir el río. Arriba, donde OSM no tiene la quebrada, sigue mandando el relieve.
  const puntosCauce = await sql<{ x: number; y: number }[]>`
    SELECT ST_X(p.geom) x, ST_Y(p.geom) y
    FROM hazard_features hf, ST_DumpPoints(ST_Segmentize(ST_Transform(hf.geom, 32718), 10)) p
    WHERE hf.category = 'cauce'`;
  const quemada = new Uint8Array(w * h);
  for (const { x, y } of puntosCauce) {
    const c = Math.floor((x - meta.x0) / meta.sx), r = Math.floor((y - meta.y0) / meta.sy);
    if (c >= 0 && r >= 0 && c < w && r < h && !quemada[r * w + c] && !Number.isNaN(z[r * w + c])) {
      quemada[r * w + c] = 1;
      z[r * w + c] -= 30;
    }
  }
  console.log(`cauces quemados: ${quemada.reduce((a, b) => a + b, 0)} celdas`);

  // 2) Priority-flood con épsilon: toda celda drena hacia el borde o hacia una celda sin dato.
  const lleno = Float64Array.from(z);
  const visto = new Uint8Array(w * h);
  const cola = new Monticulo(lleno);
  const vecinos = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  // Salida del agua: el borde de la cuadrícula y también el borde real de los datos (al reproyectar quedan
  // esquinas vacías). Sin esto el valle del Santa quedaba como un hoyo cerrado y se "rellenaba" hasta 3 437 m.
  const borde = (i: number) => {
    const r = Math.floor(i / w), c = i % w;
    if (r === 0 || c === 0 || r === h - 1 || c === w - 1) return true;
    for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) if (Number.isNaN(z[i + d])) return true;
    return false;
  };
  for (let i = 0; i < w * h; i++) {
    if (Number.isNaN(z[i])) visto[i] = 1;
    else if (borde(i)) {
      visto[i] = 1;
      cola.push(i);
    }
  }
  const EPS = 1e-3;
  while (cola.size > 0) {
    const i = cola.pop();
    const r = Math.floor(i / w), c = i % w;
    for (const d of vecinos) {
      const j = i + d;
      const rj = Math.floor(j / w), cj = j % w;
      if (j < 0 || j >= w * h || Math.abs(rj - r) > 1 || Math.abs(cj - c) > 1 || visto[j]) continue;
      visto[j] = 1;
      lleno[j] = Math.max(lleno[j], lleno[i] + EPS);
      cola.push(j);
    }
  }

  // 3) Dirección D8 de mayor pendiente sobre el relieve rellenado.
  const abajo = new Int32Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) {
    if (Number.isNaN(z[i]) || borde(i)) continue;
    const r = Math.floor(i / w), c = i % w;
    let mejor = -1, pend = 0;
    for (const d of vecinos) {
      const j = i + d;
      const rj = Math.floor(j / w), cj = j % w;
      if (Math.abs(rj - r) > 1 || Math.abs(cj - c) > 1 || Number.isNaN(lleno[j])) continue;
      const dist = rj !== r && cj !== c ? Math.SQRT2 : 1;
      const p = (lleno[i] - lleno[j]) / dist;
      if (p > pend) [pend, mejor] = [p, j];
    }
    abajo[i] = mejor;
  }

  // 4) Orígenes: huaicos ya ocurridos y zonas críticas por huaico del INGEMMET (sin los recorridos ya dibujados).
  const origenes = await sql<{ id: number; tipo: string; nombre: string; fecha: string | null; x: number; y: number }[]>`
    SELECT hf.id, hf.category AS tipo,
           coalesce(hf.properties->>'lugar', hf.properties->>'paraje', hf.properties->>'sector', d.title) AS nombre,
           hf.event_date AS fecha,
           ST_X(ST_Transform(ST_PointOnSurface(hf.geom), 32718)) x, ST_Y(ST_Transform(ST_PointOnSurface(hf.geom), 32718)) y
    FROM hazard_features hf JOIN datasets d ON d.id = hf.dataset_id
    WHERE hf.hazard_type_code = 'huaico'
      AND hf.category IN ('evento_registrado', 'area_evaluada', 'zona_critica')
      AND coalesce((hf.properties->>'es_recorrido')::boolean, false) = false`;

  const features: unknown[] = [];
  const usados = new Set<string>();
  const celdasUsadas = new Set<number>();
  for (const o of origenes) {
    const c0 = Math.floor((o.x - meta.x0) / meta.sx);
    const r0 = Math.floor((o.y - meta.y0) / meta.sy);
    if (c0 < 0 || r0 < 0 || c0 >= w || r0 >= h) continue;
    const celdas: number[] = [];
    let i = r0 * w + c0;
    while (i >= 0 && celdas.length < 2000) {
      celdas.push(i);
      i = abajo[i];
    }
    if (celdas.length < 3) continue;
    // Orígenes que caen en la misma celda o con el mismo camino no se repiten.
    const clave = `${celdas[0]}-${celdas.at(-1)}`;
    if (usados.has(clave)) continue;
    usados.add(clave);
    // Cada camino se dibuja solo hasta donde se une con otro ya dibujado (p. ej. las 14 áreas de Ichoca bajan por la
    // misma quebrada): todo huaico queda conectado y el tramo común no se repite.
    const union = celdas.findIndex((k) => celdasUsadas.has(k));
    if (union === 0) continue; // el origen ya está sobre un camino
    if (union > 0) celdas.splice(union + 1);
    for (const k of celdas) celdasUsadas.add(k);
    const seUne = union > 0;
    const coords = celdas.map((k) => [meta.x0 + ((k % w) + 0.5) * meta.sx, meta.y0 + (Math.floor(k / w) + 0.5) * meta.sy]);
    const linea = JSON.stringify({ type: "LineString", coordinates: coords });
    // Cortar al entrar a 60 m del río Santa, suavizar y pasar a lon/lat.
    const [r] = await sql<{ g: string | null; m: number }[]>`
      WITH l AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${linea}), 32718) g),
           s AS (SELECT ST_Buffer(ST_Transform(ST_Union(geom), 32718), 60) b FROM hazard_features
                 WHERE category = 'cauce' AND properties->>'nombre' = 'Río Santa'),
           corte AS (
             SELECT l.g, CASE WHEN ST_Intersects(l.g, s.b)
                         THEN (SELECT min(ST_LineLocatePoint(l.g, ST_StartPoint(p.geom)))
                               FROM ST_Dump(ST_Intersection(l.g, s.b)) p)
                         ELSE 1 END AS f
             FROM l, s)
      SELECT ST_AsGeoJSON(ST_Transform(ST_SimplifyPreserveTopology(ST_LineSubstring(g, 0, greatest(f, 0.0001)), 10), 4326), 6) g,
             ST_Length(ST_LineSubstring(g, 0, greatest(f, 0.0001))) m
      FROM corte`;
    if (!r?.g || (r.m < 60 && !seUne)) continue;
    features.push({
      type: "Feature",
      geometry: JSON.parse(r.g),
      properties: {
        origen: o.nombre,
        tipo_origen: o.tipo === "zona_critica" ? "Zona crítica por huaico (INGEMMET)" : "Huaico registrado",
        fecha_origen: o.fecha,
        longitud_m: Math.round(r.m),
        metodo: "Camino de mayor pendiente sobre Copernicus GLO-30 (30 m) con relleno de depresiones; hasta el río Santa",
        se_une_a_otro_camino: seUne,
      },
    });
  }

  await sql`DROP SCHEMA etl_caminos CASCADE`;
  await sql.end();
  writeFileSync(SALIDA, JSON.stringify({ type: "FeatureCollection", features }));
  console.log(`${features.length} caminos aguas abajo (de ${origenes.length} orígenes) → ${path.relative(ROOT, SALIDA)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
