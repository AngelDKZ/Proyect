"""Descarga ríos y quebradas de OpenStreetMap (Overpass API) para un área.

Los cauces son el camino natural de los huaicos y las crecidas. Se guardan aparte
de los datos oficiales porque OpenStreetMap tiene licencia ODbL
(atribución: "© colaboradores de OpenStreetMap").

Uso: python3 scripts/etl/osm_cauces.py <oeste,sur,este,norte> <salida.geojson>
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


def main(bbox, out_path):
    w, s, e, n = bbox.split(",")
    q = f'[out:json][timeout:120];way["waterway"~"^(river|stream)$"]({s},{w},{n},{e});out geom tags;'
    for intento in range(6):
        url = SERVIDORES[intento % len(SERVIDORES)]
        r = subprocess.run(["curl", "-sS", "--max-time", "150", "-A", UA, url, "--data-urlencode", f"data={q}"],
                           capture_output=True)
        try:
            data = json.loads(r.stdout)
            break
        except ValueError:  # servidor saturado: reintento con espera creciente
            time.sleep(15 * (intento + 1))
    else:
        raise SystemExit("Overpass no respondió; intentar más tarde.")

    feats = []
    for el in data["elements"]:
        t = el.get("tags", {})
        feats.append({
            "type": "Feature",
            "properties": {
                "osm_id": el["id"],
                "tipo": t.get("waterway"),
                "nombre": t.get("name"),
                "intermitente": t.get("intermittent") == "yes",
            },
            "geometry": {"type": "LineString", "coordinates": [[p["lon"], p["lat"]] for p in el["geometry"]]},
        })
    out = {"type": "FeatureCollection", "features": feats, "metadata": {
        "fuente": "OpenStreetMap (Overpass API), waterway=river|stream",
        "licencia": "ODbL – © colaboradores de OpenStreetMap",
        "fecha_descarga": dt.date.today().isoformat(),
        "bbox": bbox,
    }}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    nombres = sorted({f["properties"]["nombre"] for f in feats if f["properties"]["nombre"]})
    print(f"{len(feats)} cauces ({sum(1 for f in feats if f['properties']['tipo'] == 'river')} ríos). Con nombre: {nombres}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
