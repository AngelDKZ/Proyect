#!/usr/bin/env bash
# Pendiente del terreno alrededor de Huaraz a partir del modelo de elevación Copernicus GLO-30 (30 m, gratis).
#
# Clases (rangos que usa el INGEMMET en sus informes técnicos de peligros geológicos):
#   1 = fuerte (15°–25°)  · 2 = muy fuerte / escarpada (25°–45°)  · 3 = muy escarpada (> 45°)
# Por debajo de 15° no se genera polígono.
#
# Se procesa en la base local (PostGIS raster) y se exporta a GeoJSON: la base de producción no necesita rásteres.
# Copernicus es un modelo de SUPERFICIE (incluye edificios): se suaviza 3×3 antes de calcular la pendiente
# y se descartan manchas menores a ~3 celdas para no marcar bordes de edificios como laderas.
#
# Uso: scripts/etl/pendiente_copernicus.sh   (requiere el contenedor mapa-riesgo-db en marcha)
set -euo pipefail
cd "$(dirname "$0")/../.."

TILE="Copernicus_DSM_COG_10_S10_00_W078_00_DEM"
RAW="data/raw/copernicus/$TILE.tif"
OUT="data/processed/huaraz/pendiente_copernicus.geojson"
DB=(docker exec -i mapa-riesgo-db psql -U mapa -d mapa_riesgo -v ON_ERROR_STOP=1 -q)

if [ ! -f "$RAW" ]; then
  mkdir -p data/raw/copernicus
  curl -sSf -o "$RAW" "https://copernicus-dem-30m.s3.amazonaws.com/$TILE/$TILE.tif"
fi

docker cp "$RAW" mapa-riesgo-db:/tmp/dem.tif
"${DB[@]}" -c "CREATE EXTENSION IF NOT EXISTS postgis_raster; DROP SCHEMA IF EXISTS etl CASCADE; CREATE SCHEMA etl;"
docker exec mapa-riesgo-db sh -c "raster2pgsql -q -s 4326 -t 256x256 /tmp/dem.tif etl.dem | psql -U mapa -d mapa_riesgo -q -v ON_ERROR_STOP=1"

"${DB[@]}" <<'SQL'
-- Ciudad de Huaraz e Independencia, sus laderas y la parte baja de las quebradas que bajan de la cordillera.
CREATE TABLE etl.zona AS SELECT ST_MakeEnvelope(-77.62, -9.62, -77.35, -9.40, 4326) AS geom;

CREATE TABLE etl.dem_utm AS
SELECT ST_Transform(ST_Union(ST_Clip(d.rast, z.geom)), 32718, 30::float8, 30::float8, 'Bilinear') AS rast
FROM etl.dem d, etl.zona z WHERE ST_Intersects(d.rast, z.geom);

CREATE TABLE etl.clases AS
WITH suave AS (
  SELECT ST_MapAlgebra(rast, 1, 'st_mean4ma(double precision[][][], integer[][], text[])'::regprocedure, '32BF', 'FIRST', NULL, 1, 1) AS rast
  FROM etl.dem_utm
), pendiente AS (
  SELECT ST_Slope(rast, 1, '32BF', 'DEGREES') AS rast FROM suave
)
SELECT ST_Reclass(rast, 1, '[0-15):0, [15-25):1, [25-45):2, [45-90]:3', '8BUI', 0) AS rast FROM pendiente;

CREATE TABLE etl.poligonos AS
SELECT d.val::int AS clase, d.geom
FROM etl.clases c, LATERAL ST_DumpAsPolygons(c.rast) d
WHERE d.val > 0;

CREATE TABLE etl.resultado AS
SELECT clase,
       ST_Multi(ST_Transform(ST_SimplifyPreserveTopology(ST_Union(geom), 10), 4326)) AS geom
FROM (
  SELECT clase, (ST_Dump(ST_Union(geom))).geom AS geom FROM etl.poligonos GROUP BY clase
) t
WHERE ST_Area(geom) >= 2700  -- ~3 celdas de 30 m: descarta manchas sueltas (bordes de edificios, ruido)
GROUP BY clase;
SQL

docker exec mapa-riesgo-db psql -U mapa -d mapa_riesgo -At -c "
SELECT json_build_object('type','FeatureCollection','features', json_agg(json_build_object(
  'type','Feature',
  'geometry', ST_AsGeoJSON(geom, 6)::json,
  'properties', json_build_object('clase', clase,
     'etiqueta', CASE clase WHEN 1 THEN 'Fuerte (15°–25°)' WHEN 2 THEN 'Muy fuerte (25°–45°)' ELSE 'Muy escarpada (> 45°)' END,
     'fuente', 'Copernicus GLO-30 DEM (ESA), pendiente calculada; clases del INGEMMET')
) ORDER BY clase))
FROM etl.resultado" > "$OUT"

"${DB[@]}" -c "DROP SCHEMA etl CASCADE;"
echo "pendiente exportada a $OUT ($(wc -c < "$OUT") bytes)"
