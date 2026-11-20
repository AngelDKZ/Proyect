# Digitalización del mapa oficial de Huaraz e Independencia

Estos scripts convierten la imagen del mapa oficial en datos geográficos (GeoJSON) que la app puede usar.

**Mapa de origen:** "Mapa de zonas seguras y rutas de evacuación ante aluviones en Huaraz e Independencia – Zona baja, subcuenca río Quillcay" (mayo 2025).
- Lo elaboraron la Municipalidad Provincial de Huaraz (OGRDyDC), el INAIGEM y la Municipalidad de Independencia.
- Lo aprobó la Plataforma Provincial de Defensa Civil el 26-05-2025.
- Ficha y descarga: https://sinia.minam.gob.pe/mapas/mapa-zonas-seguras-rutas-evacuacion-ante-aluviones-huaraz-independencia

## Requisitos

Python 3 y las librerías de `requirements.txt`, instaladas en un entorno virtual aparte. No son dependencias de la app.

```bash
python3 -m venv .venv-etl
.venv-etl/bin/pip install -r scripts/etl/requirements.txt
```

## Ejecución

Se ejecuta desde `scripts/etl/`:

```bash
PNG=../../data/raw/huaraz/mapa_zonas_seguras_2025.png
OUT=../../data/processed/huaraz
../../.venv-etl/bin/python huaraz_zonas_peligro.py   $PNG $OUT/zonas_peligro.geojson
../../.venv-etl/bin/python huaraz_zonas_seguras.py   ../../data/raw/huaraz/iconos_revisados.json $OUT/zonas_peligro.geojson $OUT/zonas_seguras.geojson
../../.venv-etl/bin/python huaraz_flechas_evacuacion.py $PNG $OUT/flechas_evacuacion.geojson "" 0.28
```

`huaraz_detectar_iconos.py` solo sirve para proponer candidatos. La lista oficial de puntos es `data/raw/huaraz/iconos_revisados.json`, revisada a mano.

## Archivos

| Script | Qué hace |
|---|---|
| `huaraz_georef.py` | Georreferenciación compartida. Usa la grilla UTM 18S del marco del mapa; el residuo máximo es 0,64 m y la escala, 1,44 m por píxel. |
| `huaraz_zonas_peligro.py` | Convierte los 4 niveles de peligro (muy alto, alto, medio, bajo) en polígonos. |
| `huaraz_detectar_iconos.py` | Detecta los íconos de zonas seguras y puntos de atención por su color. |
| `huaraz_zonas_seguras.py` | Genera los puntos a partir de la lista revisada. Además avisa si algún punto cae en una zona de peligro. |
| `huaraz_flechas_evacuacion.py` | Detecta las flechas de ruta de evacuación y su rumbo. |
| `osm_lugares.py` | Nombres de barrios, plazas, mercados, colegios y calles de OpenStreetMap para el buscador (`python3 osm_lugares.py -77.62,-9.62,-77.43,-9.43 ../../data/processed/huaraz/osm_lugares.geojson`). Solo usa la biblioteca estándar. |
| `pendiente_copernicus.sh` | Pendiente del terreno desde el modelo de elevación Copernicus GLO-30, procesada en la base local con PostGIS raster. Requiere el contenedor `mapa-riesgo-db`. |
| `huaico_caminos.ts` | Camino aguas abajo (según el relieve, con los cauces de OSM quemados) desde cada huaico ocurrido y zona crítica del INGEMMET hasta el río Santa. Lee los orígenes de la base: `npm run db:cargar`, luego `npm run datos:caminos`, y otra vez `npm run db:cargar`. |
| `osm_calles.py` | Vías caminables de OpenStreetMap para las rutas a pie (`python3 osm_calles.py -77.60,-9.60,-77.47,-9.46 ../../data/processed/huaraz/osm_calles.geojson`). |

## Resultados (19-11-2026)

| Capa | Contenido |
|---|---|
| `zonas_peligro.geojson` | Muy alto ≈ 177 ha, alto ≈ 37 ha, medio ≈ 10 ha, bajo ≈ 21 ha |
| `zonas_seguras.geojson` | 36 puntos: 14 zonas de seguridad, 6 refugios temporales, 6 centros de acopio, 4 de atención médica, 2 puestos de comando, 2 de atención animal y 2 de gestión de cadáveres. Ninguno está dentro de una zona de peligro ni a menos de 15 m de ella. |
| `flechas_evacuacion.geojson` | 169 flechas con su rumbo. Se estima que faltan alrededor de un 5%: las que quedan tapadas por texto o por líneas. |
| `revision_digitalizacion.png` | Las tres capas dibujadas sobre el mapa original, para revisarlas. |

**Validación:**
- La Plaza de Armas digitalizada queda a 12 m de la de OpenStreetMap.
- El cauce del río Quillcay coincide con el de OpenStreetMap, con un desplazamiento medio menor a 2 m.

**Pendiente:**
- Una persona del equipo debe revisar cada capa (estado `pendiente_revision_humana`).
- Hay que reemplazar estos datos por los archivos oficiales si la municipalidad o el INAIGEM los entregan.
