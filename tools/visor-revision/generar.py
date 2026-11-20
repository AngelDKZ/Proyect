"""Genera visor.html: un visor interactivo de revisión con los datos de Huaraz incrustados.

Solo usa la biblioteca estándar de Python. Uso (desde la raíz del proyecto):
    python3 tools/visor-revision/generar.py
Después abre tools/visor-revision/visor.html en el navegador (necesita internet
para cargar el mapa base y la librería MapLibre).
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "processed" / "huaraz"
HERE = pathlib.Path(__file__).resolve().parent


def load(name):
    with open(DATA / name, encoding="utf-8") as f:
        return json.dumps(json.load(f), ensure_ascii=False, separators=(",", ":"))


html = (HERE / "plantilla.html").read_text(encoding="utf-8")
html = (html.replace("__PELIGRO__", load("zonas_peligro.geojson"))
            .replace("__SEGURAS__", load("zonas_seguras.geojson"))
            .replace("__FLECHAS__", load("flechas_evacuacion.geojson"))
            .replace("__ING_AREAS__", load("ingemmet_cartografia_areas.geojson"))
            .replace("__ING_INVENTARIO__", load("ingemmet_inventario_puntos.geojson"))
            .replace("__ING_OTROS__", load("ingemmet_otros_peligros_puntos.geojson"))
            .replace("__ING_CRITICAS__", load("ingemmet_zonas_criticas_puntos.geojson"))
            .replace("__ING_SUSCEP__", load("ingemmet_susceptibilidad_mov_masa.geojson"))
            .replace("__OSM_CAUCES__", load("osm_cauces.geojson"))
            .replace("__MUNI_LLUVIAS__", load("municipalidad_lluvias_2025.geojson"))
            .replace("__ANIEGOS_CENTRO__", load("aniegos_centro.geojson"))
            .replace("__MANZANAS__", load("manzanas_peligro.geojson"))
            .replace("__NOTICIAS__", load("noticias_inundaciones.geojson"))
            .replace("__NOTICIAS_DET__", json.dumps(json.load(open(ROOT / "data" / "raw" / "huaraz" / "noticias_inundaciones.json", encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))))
assert "__" not in html.split("<script>")[1].split("const NIVELES")[0], "quedó un marcador sin reemplazar"
out = HERE / "visor.html"
out.write_text(html, encoding="utf-8")
print(f"Generado {out} ({out.stat().st_size / 1024:.0f} KB)")
