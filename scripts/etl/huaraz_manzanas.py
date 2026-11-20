"""Asigna a cada manzana censal del distrito de Huaraz el nivel de cada peligro.

Cruza las 1007 manzanas del INEI (data/raw/inei/huaraz_manzanas_inei.geojson) con las
capas ya procesadas en data/processed/huaraz/. No crea información nueva: reparte
por manzana lo que dicen las fuentes y marca "sin información" donde no hay datos.

Una manzana se evalúa en su centroide y en sus vértices: basta que uno de esos puntos
caiga en una zona para asignarle el nivel. Se toma el nivel más alto.

Niveles por peligro (n_*):
  -1 = evaluado, sin peligro identificado (aluvión: dentro del área del mapa oficial;
       deslizamiento: susceptibilidad baja o muy baja)
   0 = sin información
   1..4 = de menor a mayor (ver NIVEL_TXT en el visor)

Uso (solo biblioteca estándar):
  python3 scripts/etl/huaraz_manzanas.py
"""

import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROC = ROOT / "data" / "processed" / "huaraz"
RAW = ROOT / "data" / "raw"

K = math.pi / 180
R = 6371008.8
LAT0 = -9.53
COS0 = math.cos(LAT0 * K)


def m(p):  # coordenadas aproximadas en metros (suficiente a escala de ciudad)
    return (p[0] * K * R * COS0, p[1] * K * R)


def dist(a, b):
    ax, ay = m(a)
    bx, by = m(b)
    return math.hypot(ax - bx, ay - by)


def dist_linea(p, linea):
    px, py = m(p)
    best = float("inf")
    for a, b in zip(linea[:-1], linea[1:]):
        ax, ay = m(a)
        bx, by = m(b)
        dx, dy = bx - ax, by - ay
        t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return best


def en_anillo(p, anillo):
    x, y = p
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i]
        xj, yj = anillo[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def poligonos(geom):
    return [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]


class Zona:
    """Polígono con caja envolvente para descartar rápido."""

    def __init__(self, geom, props):
        self.polys = poligonos(geom)
        xs = [c[0] for poly in self.polys for c in poly[0]]
        ys = [c[1] for poly in self.polys for c in poly[0]]
        self.bbox = (min(xs), min(ys), max(xs), max(ys))
        self.props = props

    def contiene(self, p):
        x0, y0, x1, y1 = self.bbox
        if not (x0 <= p[0] <= x1 and y0 <= p[1] <= y1):
            return False
        return any(en_anillo(p, poly[0]) and not any(en_anillo(p, h) for h in poly[1:]) for poly in self.polys)


def cargar(nombre, base=PROC):
    with open(base / nombre, encoding="utf-8") as f:
        return json.load(f)


def categorias(p):
    t = " ".join(str(p.get(k) or "") for k in ("PELIGRO_ES", "NOM_PELIGRO_TXT", "TIP_PELIGRO_TXT", "PELIGROS_G")).lower()
    c = set()
    if re.search(r"flujo|huaico", t): c.add("huaico")
    if re.search(r"desliz|reptaci|movimiento complejo", t): c.add("deslizamiento")
    if re.search(r"ca[ií]da|derrumbe|avalancha de rocas", t): c.add("caida")
    if re.search(r"erosi|c[aá]rcava|bad lands", t): c.add("erosion")
    return c


def main():
    manz = cargar("huaraz_manzanas_inei.geojson", RAW / "inei")["features"]

    peligro = cargar("zonas_peligro.geojson")
    cobertura = Zona(peligro["cobertura"], {})
    aluvion = [Zona(f["geometry"], f["properties"]) for f in peligro["features"]]
    ORDEN = {"bajo": 1, "medio": 2, "alto": 3, "muy_alto": 4}

    muni = cargar("municipalidad_lluvias_2025.geojson")["features"]
    sectores = [f for f in muni if f["properties"]["tipo"] == "zona_critica_lluvia"]
    canal = [f for f in muni if f["properties"]["tipo"] == "zona_critica_lluvia_linea"]
    sinpad = [f for f in muni if f["properties"]["tipo"] == "emergencia_sinpad"]
    aniegos = [f for f in cargar("aniegos_centro.geojson")["features"] if f["properties"]["tipo"] == "aniego_recurrente"]
    noticias = cargar("noticias_inundaciones.geojson")["features"]

    ing_areas = [Zona(f["geometry"], {**f["properties"], "_cats": categorias(f["properties"])})
                 for f in cargar("ingemmet_cartografia_areas.geojson")["features"]]
    ing_puntos = [f for n in ("ingemmet_inventario_puntos.geojson", "ingemmet_otros_peligros_puntos.geojson")
                  for f in cargar(n)["features"]]
    for f in ing_puntos:
        f["_cats"] = categorias(f["properties"])
    suscep = [Zona(f["geometry"], f["properties"]) for f in cargar("ingemmet_susceptibilidad_mov_masa.geojson")["features"]]
    SUSC = {5: 3, 4: 2, 3: 1}  # muy alta -> 3, alta -> 2, media -> 1

    salida = []
    for mz in manz:
        polys = poligonos(mz["geometry"])
        anillo = polys[0][0]
        n = len(anillo) - 1
        centro = (sum(c[0] for c in anillo[:n]) / n, sum(c[1] for c in anillo[:n]) / n)
        pts = [centro] + [tuple(c) for c in anillo[:n]][:24]
        det = {"aluvion": [], "lluvias": [], "huaico": [], "deslizamiento": [], "caida": [], "erosion": []}
        niv = {k: 0 for k in det}

        def sube(peligro_, valor, texto):
            if valor > niv[peligro_]:
                niv[peligro_] = valor
            if texto not in det[peligro_]:
                det[peligro_].append(texto)

        # Aluvión (y huaico por el Quillcay, mismo modelo)
        if any(cobertura.contiene(p) for p in pts):
            niv["aluvion"] = -1
            for z in aluvion:
                if any(z.contiene(p) for p in pts):
                    v = ORDEN[z.props["nivel_peligro"]]
                    nombre = z.props["nivel_peligro"].replace("_", " ")
                    sube("aluvion", v, f"Aluvión: peligro {nombre} (mapa oficial 2025)")
                    sube("huaico", v, f"Recorrido de un flujo por el Quillcay: peligro {nombre} (modelo INAIGEM)")

        # Inundación por lluvias
        for f in aniegos:
            if min(dist_linea(p, f["geometry"]["coordinates"]) for p in pts) <= 20:
                sube("lluvias", 3, "Av. Luzuriaga: aniegos recurrentes (Contraloría 2025)")
        for f in noticias:
            pr = f["properties"]
            radio = 60 if pr["confianza_ubicacion"] == "alta" else 150
            if min(dist(p, f["geometry"]["coordinates"]) for p in pts) <= radio:
                sube("lluvias", 3 if radio == 60 else 2, f"Inundación en noticias: {pr['lugar']} ({pr['n_eventos']} vez/veces, última {pr['ultima_fecha']})")
        for f in sectores:
            pr = f["properties"]
            if min(dist(p, f["geometry"]["coordinates"]) for p in pts) <= 200:
                sube("lluvias", 2, f"Zona crítica por lluvias e inundación: {pr['zona']} – {pr['sector']} (Municipalidad 2025, área aproximada)")
                if pr["zona"] == "Río Seco":
                    sube("huaico", 2, f"Río Seco – sector {pr['sector']}: flujo e inundación de detritos (INGEMMET / Municipalidad)")
        for f in canal:
            if min(dist_linea(p, f["geometry"]["coordinates"]) for p in pts) <= 30:
                sube("lluvias", 1, "Canal de Tajamar (ubicación tentativa)")

        # Peligros geológicos del INGEMMET
        for z in ing_areas:
            if any(z.contiene(p) for p in pts):
                for c in z.props["_cats"]:
                    sube(c, 4, f"Área evaluada por el INGEMMET: {z.props.get('PELIGRO_ES')} ({z.props.get('FECHA_EVAL')})")
        for f in ing_puntos:
            if min(dist(p, f["geometry"]["coordinates"]) for p in pts) <= 50:
                pr = f["properties"]
                tipo = pr.get("NOM_PELIGRO_TXT") or pr.get("TIP_PELIGRO_TXT") or "peligro geológico"
                for c in f["_cats"]:
                    sube(c, 2, f"{tipo} ya ocurrido a menos de 50 m (INGEMMET, {pr.get('FECHA_TXT') or 's/f'})")
        for f in sinpad:
            if min(dist(p, f["geometry"]["coordinates"]) for p in pts) <= 150:
                sube("deslizamiento", 2, f"Emergencia SINPAD cercana: {f['properties']['sector']} ({f['properties']['fecha']})")
        mejor = 0
        for z in suscep:
            if any(z.contiene(p) for p in pts):
                mejor = max(mejor, int(z.props["LEYENDA"]))
        nombres = {5: "muy alta", 4: "alta", 3: "media", 2: "baja", 1: "muy baja"}
        if mejor >= 3:
            sube("deslizamiento", SUSC[mejor], f"Susceptibilidad del terreno a moverse: {nombres[mejor]} (INGEMMET, escala regional)")
        elif mejor:
            det["deslizamiento"].append(f"Susceptibilidad del terreno a moverse: {nombres[mejor]} (INGEMMET, escala regional)")
            if niv["deslizamiento"] == 0:
                niv["deslizamiento"] = -1  # evaluado: susceptibilidad baja

        pr = mz["properties"]
        props = {"id": pr["idmanzana"], "zona": pr["zona"], "manzana": pr["manzana"], "ccpp": pr["codccpp"]}
        for k in niv:
            props["n_" + k] = niv[k]
            props["d_" + k] = " | ".join(det[k])
        geom = {"type": mz["geometry"]["type"],
                "coordinates": [[[[round(c[0], 6), round(c[1], 6)] for c in r] for r in poly] for poly in polys]}
        salida.append({"type": "Feature", "properties": props, "geometry": geom})

    out = {"type": "FeatureCollection", "name": "huaraz_manzanas_peligro", "metadata": {
        "fuente_manzanas": "INEI – GeoServer de interoperabilidad, capa ig_manzana (ubigeo 020101)",
        "metodo": "Centroide y vértices de cada manzana cruzados con las capas de data/processed/huaraz/. -1 = evaluado sin peligro identificado; 0 = sin información."},
        "features": salida}
    (PROC / "manzanas_peligro.geojson").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for k in ("aluvion", "lluvias", "huaico", "deslizamiento", "caida", "erosion"):
        cont = {}
        for f in salida:
            v = f["properties"]["n_" + k]
            cont[v] = cont.get(v, 0) + 1
        print(f"{k:14s}", dict(sorted(cont.items())))
    print("manzanas:", len(salida), "->", PROC / "manzanas_peligro.geojson")


if __name__ == "__main__":
    main()
