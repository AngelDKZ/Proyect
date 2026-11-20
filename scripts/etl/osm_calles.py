"""Calles y caminos peatonales de OpenStreetMap para calcular rutas a pie hacia los lugares seguros.

Se guardan una vez: la app calcula las rutas en su propio servidor, sin servicios externos.
Licencia ODbL: "© colaboradores de OpenStreetMap".

Uso: python3 scripts/etl/osm_calles.py <oeste,sur,este,norte> <salida.geojson>
"""

import datetime as dt
import json
import subprocess
import sys
import time

SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "mapa-riesgo-comunitario/0.1 (proyecto academico)"
# Vías por las que se puede caminar (se excluyen autopistas y vías privadas o en construcción).
CAMINABLES = "primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|trunk|trunk_link|unclassified|residential|living_street|service|pedestrian|footway|path|steps|track|cycleway"


def main(bbox, out_path):
    w, s, e, n = bbox.split(",")
    q = f"""[out:json][timeout:180];
way["highway"~"^({CAMINABLES})$"]["access"!~"^(private|no)$"]["foot"!="no"]({s},{w},{n},{e});
out geom tags;"""
    for intento in range(6):
        url = SERVIDORES[intento % len(SERVIDORES)]
        r = subprocess.run(["curl", "-sS", "--max-time", "200", "-A", UA, url, "--data-urlencode", f"data={q}"], capture_output=True)
        try:
            data = json.loads(r.stdout)
            break
        except ValueError:
            time.sleep(15 * (intento + 1))
    else:
        raise SystemExit("Overpass no respondió; intentar más tarde.")

    feats = []
    for el in data["elements"]:
        g = el.get("geometry") or []
        if len(g) < 2:
            continue
        t = el.get("tags", {})
        feats.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[p["lon"], p["lat"]] for p in g]},
            "properties": {"osm_id": el["id"], "tipo": t.get("highway"), "nombre": t.get("name")},
        })
    out = {"type": "FeatureCollection", "features": feats, "metadata": {
        "fuente": "OpenStreetMap (Overpass API), vías caminables",
        "licencia": "ODbL – © colaboradores de OpenStreetMap",
        "fecha_descarga": dt.date.today().isoformat(),
        "bbox": bbox,
    }}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"{len(feats)} vías caminables ({sum(1 for f in feats if f['properties']['nombre'])} con nombre)")


if __name__ == "__main__":
    main(*sys.argv[1:3])
