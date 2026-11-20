"""Nombres de barrios, calles y lugares de OpenStreetMap para el buscador de la app.

Se descargan una vez y se guardan: la app busca en su propia base, sin depender de un servicio
externo en cada búsqueda (Nominatim limita a 1 consulta por segundo y no permite autocompletar).

- Barrios: place=suburb|neighbourhood|quarter|hamlet|village|locality|isolated_dwelling (punto o área).
- Calles: highway con nombre; los tramos con el mismo nombre se agrupan y se usa el punto central del tramo central.
- Lugares: plazas (también como relación peatonal), mercados, colegios, hospitales y parques con nombre.

Licencia ODbL: "© colaboradores de OpenStreetMap".
Uso: python3 scripts/etl/osm_lugares.py <oeste,sur,este,norte> <salida.geojson>
"""

import datetime as dt
import json
import subprocess
import sys
import time
from collections import defaultdict

SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = "mapa-riesgo-comunitario/0.1 (proyecto academico)"


def overpass(q):
    for intento in range(6):
        url = SERVIDORES[intento % len(SERVIDORES)]
        r = subprocess.run(["curl", "-sS", "--max-time", "150", "-A", UA, url, "--data-urlencode", f"data={q}"],
                           capture_output=True)
        try:
            return json.loads(r.stdout)
        except ValueError:  # servidor saturado: reintento con espera creciente
            time.sleep(15 * (intento + 1))
    raise SystemExit("Overpass no respondió; intentar más tarde.")


def centro(el):
    if "lat" in el:
        return [el["lon"], el["lat"]]
    if "center" in el:
        return [el["center"]["lon"], el["center"]["lat"]]
    if "bounds" in el:  # relaciones con «out geom»: centro del recuadro
        b = el["bounds"]
        return [(b["minlon"] + b["maxlon"]) / 2, (b["minlat"] + b["maxlat"]) / 2]
    g = el.get("geometry") or []
    if g:
        p = g[len(g) // 2]
        return [p["lon"], p["lat"]]
    return None


def main(bbox, out_path):
    w, s, e, n = bbox.split(",")
    caja = f"({s},{w},{n},{e})"
    q = f"""[out:json][timeout:120];
(
  node["place"~"^(suburb|neighbourhood|quarter|hamlet|village|locality|isolated_dwelling)$"]["name"]{caja};
  way["place"~"^(suburb|neighbourhood|quarter|hamlet|village|locality)$"]["name"]{caja};
  relation["place"~"^(suburb|neighbourhood|quarter)$"]["name"]{caja};
  node["amenity"~"^(marketplace|school|kindergarten|college|hospital|clinic|doctors|university|townhall|police|fire_station|community_centre)$"]["name"]{caja};
  way["amenity"~"^(marketplace|school|kindergarten|college|hospital|clinic|doctors|university|townhall|police|fire_station|community_centre)$"]["name"]{caja};
  way["leisure"~"^(park|stadium)$"]["name"]{caja};
  way["place"="square"]["name"]{caja};
  way["highway"]["name"]{caja};
  relation["highway"="pedestrian"]["name"]{caja};
  relation["leisure"~"^(park|stadium)$"]["name"]{caja};
);
out center geom tags;"""
    data = overpass(q)

    lugares, calles = [], defaultdict(list)
    for el in data["elements"]:
        t = el.get("tags", {})
        nombre = (t.get("name") or "").strip()
        if not nombre:
            continue
        if "highway" in t and el["type"] == "way":
            calles[nombre].append(el)
            continue
        c = centro(el)
        if not c:
            continue
        tipo = "barrio" if t.get("place") not in (None, "square") else "lugar"
        lugares.append({"nombre": nombre, "tipo": tipo, "coord": c, "osm": f"{el['type']}/{el['id']}"})

    for nombre, tramos in calles.items():
        # Tramo central (por longitud de la lista de tramos ordenados por posición) como referencia de la calle.
        tramos.sort(key=lambda el: (centro(el) or [0, 0])[0])
        c = centro(tramos[len(tramos) // 2])
        if c:
            lugares.append({"nombre": nombre, "tipo": "calle", "coord": c, "osm": f"way/{tramos[0]['id']}"})

    # Quitar duplicados exactos (mismo nombre y tipo a menos de ~100 m).
    vistos, unicos = [], []
    for l in lugares:
        if any(v["nombre"] == l["nombre"] and v["tipo"] == l["tipo"]
               and abs(v["coord"][0] - l["coord"][0]) < 0.001 and abs(v["coord"][1] - l["coord"][1]) < 0.001
               for v in vistos):
            continue
        vistos.append(l)
        unicos.append(l)

    feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": l["coord"]},
              "properties": {"nombre": l["nombre"], "tipo": l["tipo"], "osm": l["osm"]}} for l in unicos]
    out = {"type": "FeatureCollection", "features": feats, "metadata": {
        "fuente": "OpenStreetMap (Overpass API): place, amenity, leisure y highway con nombre",
        "licencia": "ODbL – © colaboradores de OpenStreetMap",
        "fecha_descarga": dt.date.today().isoformat(),
        "bbox": bbox,
    }}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    por_tipo = defaultdict(int)
    for l in unicos:
        por_tipo[l["tipo"]] += 1
    print(f"{len(unicos)} lugares: {dict(por_tipo)}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
