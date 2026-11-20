"""Genera el GeoJSON de zonas seguras y puntos de atención de Huaraz e Independencia.

Entrada:
  data/raw/huaraz/iconos_revisados.json      (lista revisada, en píxeles)
  data/processed/huaraz/zonas_peligro.geojson (para el control de calidad)
Salida:
  data/processed/huaraz/zonas_seguras.geojson (EPSG:4326)

Control de calidad: avisa si algún punto cae dentro de una zona de peligro del
mismo mapa, o a menos de 15 m de ella. Ese punto se marca para revisión.

Uso: python scripts/etl/huaraz_zonas_seguras.py <iconos_revisados.json> <zonas_peligro.geojson> <salida.geojson>
"""

import json
import math
import sys

from pyproj import Transformer

from huaraz_georef import px_to_utm

TIPOS = {
    "zona_seguridad": "Zona de seguridad: refugio provisional de personas ante un desastre",
    "refugio_temporal": "Refugio temporal: lugar momentáneo para brindar alojamiento y resguardo a personas evacuadas",
    "centro_acopio": "Centro de acopio: lugar donde se reciben y distribuyen donativos",
    "atencion_medica": "Atención prehospitalaria y hospitalaria: atención médica de personas ante un desastre",
    "puesto_comando": "Puesto de comando: lugar para coordinar todas las actividades durante la emergencia",
    "atencion_animal": "Centro de atención de vida animal: atención de animales ante un desastre",
    "gestion_cadaveres": "Centro de gestión de cadáveres: lugar de recuperación e identificación de cadáveres después del desastre",
}

FUENTE = {
    "fuente": "Mapa de zonas seguras y rutas de evacuación ante aluviones en Huaraz e Independencia – Zona baja, subcuenca río Quillcay",
    "institucion": "Municipalidad Provincial de Huaraz (OGRDyDC), INAIGEM, Municipalidad Distrital de Independencia",
    "fecha_fuente": "2025-05",
    "validacion": "Aprobado por la Plataforma Provincial de Defensa Civil de Huaraz, 26-05-2025",
    "url_fuente": "https://sinia.minam.gob.pe/mapas/mapa-zonas-seguras-rutas-evacuacion-ante-aluviones-huaraz-independencia",
    "tipo_peligro": "aluvion",
}


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def seg_dist(p, a, b):
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def main(iconos_path, peligro_path, out_path):
    to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32718", always_xy=True)
    to_wgs = Transformer.from_crs("EPSG:32718", "EPSG:4326", always_xy=True)

    # Zonas de peligro en UTM (metros) para medir distancias
    hazard = []
    for f in json.load(open(peligro_path, encoding="utf-8"))["features"]:
        lvl = f["properties"]["nivel_peligro"]
        for poly in f["geometry"]["coordinates"]:
            rings = [[to_utm.transform(lon, lat) for lon, lat in r] for r in poly]
            hazard.append((lvl, rings))

    data = json.load(open(iconos_path, encoding="utf-8"))
    features, alerts = [], []
    for i, p in enumerate(data["puntos"]):
        e, n = px_to_utm(*p["punta_px"])
        lon, lat = to_wgs.transform(e, n)
        inside, near = None, None
        for lvl, rings in hazard:
            if point_in_ring(e, n, rings[0]) and not any(point_in_ring(e, n, h) for h in rings[1:]):
                inside = lvl
            d = min(seg_dist((e, n), a, b) for r in rings for a, b in zip(r[:-1], r[1:]))
            if d <= 15 and (near is None or d < near[1]):
                near = (lvl, round(d, 1))
        estado = "pendiente_revision_humana"
        obs = p.get("nota")
        if inside or near:
            estado = "requiere_revision"
            msg = f"Dentro de zona de peligro {inside}" if inside else f"A {near[1]} m de zona de peligro {near[0]}"
            obs = f"{obs} {msg}." if obs else f"{msg}."
            alerts.append((i, p["tipo"], p.get("nombre") or p["referencia"], msg))
        features.append({
            "type": "Feature",
            "properties": {
                "id": f"huaraz-2025-{i + 1:03d}",
                "tipo": p["tipo"],
                "descripcion_tipo": TIPOS[p["tipo"]],
                "nombre": p.get("nombre"),
                "referencia": p["referencia"],
                **FUENTE,
                "metodo": "Digitalizado por el proyecto: punta del ícono en la imagen oficial georreferenciada con la grilla UTM 18S",
                "origen_digitalizacion": p["origen"],
                "precision_aprox_m": 15,
                "estado_verificacion": estado,
                "observaciones": obs,
            },
            "geometry": {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]},
        })

    out = {"type": "FeatureCollection", "name": "huaraz_zonas_seguras_2025", "features": features}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    counts = {}
    for f in features:
        counts[f["properties"]["tipo"]] = counts.get(f["properties"]["tipo"], 0) + 1
    print("puntos:", len(features), counts)
    print("alertas de control de calidad:", len(alerts))
    for a in alerts:
        print("  ", a)
    print("guardado", out_path)


if __name__ == "__main__":
    main(*sys.argv[1:4])
