"""Descarga capas de peligros del INGEMMET (GEOCATMIN) para un área.

Solo usa la biblioteca estándar de Python y curl. Guarda una copia fechada en
GeoJSON (EPSG:4326) y traduce los códigos a texto con los dominios del servicio
o, si no los hay, con las etiquetas de su simbología.

Capas descargadas:
  SERV_PELIGROS_GEOLOGICOS
    0 Peligros geológicos (inventario, puntos)
    1 Otros peligros geológicos (puntos)
    2 Zonas críticas (puntos)
    6 Cartografía de peligros (polígonos con la extensión evaluada en informes técnicos)
  SERV_SUSCEPTIBLE_MOV_MASA_REGIONAL
    1 Susceptibilidad a movimientos en masa (polígonos, escala regional)

Uso: python3 scripts/etl/ingemmet_descargar.py <oeste,sur,este,norte> <dir_salida>
Ej.: python3 scripts/etl/ingemmet_descargar.py -77.60,-9.58,-77.44,-9.44 data/processed/huaraz
"""

import datetime as dt
import json
import pathlib
import subprocess
import sys
import time
import urllib.parse

ROOT = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services"
UA = "mapa-riesgo-comunitario/0.1 (proyecto academico)"
CAPAS = [
    ("SERV_PELIGROS_GEOLOGICOS", 0, "ingemmet_inventario_puntos"),
    ("SERV_PELIGROS_GEOLOGICOS", 1, "ingemmet_otros_peligros_puntos"),
    ("SERV_PELIGROS_GEOLOGICOS", 2, "ingemmet_zonas_criticas_puntos"),
    ("SERV_PELIGROS_GEOLOGICOS", 6, "ingemmet_cartografia_areas"),
    ("SERV_SUSCEPTIBLE_MOV_MASA_REGIONAL", 1, "ingemmet_susceptibilidad_mov_masa"),
]
LOTE = 200  # elementos por consulta (el servicio no admite paginación por offset)


def get_json(url, params=None):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    # Se usa curl porque el servidor de GEOCATMIN envía una cadena de certificados
    # incompleta que urllib no acepta. curl sigue verificando el certificado.
    for intento in range(4):
        try:
            r = subprocess.run(["curl", "-sS", "--fail", "--max-time", "120", "-A", UA, url],
                               capture_output=True, check=True)
            data = json.loads(r.stdout)
            if "error" in data:
                raise RuntimeError(data["error"])
            return data
        except Exception as e:  # el servidor a veces falla; reintento con espera
            if intento == 3:
                raise SystemExit(f"Falló la consulta {url[:120]}…: {e}")
            time.sleep(5 * (intento + 1))


def tablas_de_codigos(meta):
    out = {}
    for f in meta.get("fields", []):
        dom = f.get("domain") or {}
        if dom.get("codedValues"):
            out[f["name"]] = {str(c["code"]): c["name"] for c in dom["codedValues"]}
    rend = (meta.get("drawingInfo") or {}).get("renderer") or {}
    if rend.get("type") == "uniqueValue" and rend.get("field1") and rend["field1"] not in out:
        out[rend["field1"]] = {str(v["value"]): v["label"] for v in rend.get("uniqueValueInfos", [])}
    return out


def main(bbox, out_dir):
    out_dir = pathlib.Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    hoy = dt.date.today().isoformat()
    for servicio, layer, nombre in CAPAS:
        url = f"{ROOT}/{servicio}/MapServer/{layer}"
        meta = get_json(url, {"f": "json"})
        codigos = tablas_de_codigos(meta)
        geo = {"geometry": bbox, "geometryType": "esriGeometryEnvelope", "inSR": 4326,
               "spatialRel": "esriSpatialRelIntersects"}
        ids = get_json(f"{url}/query", {**geo, "returnIdsOnly": "true", "f": "json"}).get("objectIds") or []
        ids.sort()
        feats = []
        for i in range(0, len(ids), LOTE):
            lote = get_json(f"{url}/query", {"objectIds": ",".join(map(str, ids[i:i + LOTE])),
                                             "outFields": "*", "outSR": 4326, "returnGeometry": "true",
                                             "f": "geojson"})
            feats.extend(lote.get("features", []))
        if len(feats) != len(ids):
            raise SystemExit(f"{nombre}: se esperaban {len(ids)} elementos y llegaron {len(feats)}")
        for feat in feats:
            p = feat["properties"]
            for campo, tabla in codigos.items():
                if campo in p and p[campo] is not None and str(p[campo]) in tabla:
                    p[campo + "_TXT"] = tabla[str(p[campo])]
            if isinstance(p.get("FECHA"), (int, float)):
                p["FECHA_TXT"] = dt.datetime.fromtimestamp(p["FECHA"] / 1000, dt.UTC).date().isoformat()
        data = {"type": "FeatureCollection", "features": feats, "metadata": {
            "fuente": f"INGEMMET – GEOCATMIN, servicio {servicio}, capa {layer} ({meta.get('name')})",
            "url": url,
            "fecha_descarga": hoy,
            "licencia": "No indicada en el servicio. El inventario y las zonas críticas también se publican en datosabiertos.gob.pe con licencia ODC-BY.",
            "bbox": bbox,
        }}
        path = out_dir / f"{nombre}.geojson"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"{servicio}/{layer} ({meta.get('name')}): {len(feats)} elementos -> {path}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
