"""Digitaliza los niveles de peligro del mapa oficial de Huaraz e Independencia.

Fuente: "Mapa de zonas seguras y rutas de evacuación ante aluviones en Huaraz e
Independencia (Áncash) – Zona baja, subcuenca río Quillcay". Lo elaboraron la
OGRDyDC de la Municipalidad Provincial de Huaraz, el INAIGEM y la Municipalidad
de Independencia, en mayo de 2025. Lo aprobó la Plataforma Provincial de Defensa
Civil el 26-05-2025.

Entrada:  data/raw/huaraz/mapa_zonas_seguras_2025.png (3508 x 2480 px)
Salida:   data/processed/huaraz/zonas_peligro.geojson (EPSG:4326)

Uso:  python scripts/etl/huaraz_zonas_peligro.py <png> <salida.geojson> [<preview.png>]

Método:
1. Georreferenciación con las marcas UTM del marco (WGS84 / UTM 18S, EPSG:32718).
   El mapa está girado 90°: el norte apunta a la izquierda.
2. Clasificación por color exacto de cada nivel de peligro.
3. Relleno de los píxeles tapados por flechas, textos, calles, río y símbolos
   dentro de la mancha de peligro, asignándoles el nivel más cercano.
4. Vectorización, simplificación (~2 m) y reproyección a WGS84.

Limitaciones: precisión aproximada de ±10 m. Es un escenario modelado (aluvión
desde la laguna Palcacocha). Solo cubre el área visible dentro del marco del mapa.
"""

import json
import sys

import cv2
import numpy as np
from PIL import Image

from huaraz_georef import FRAME, M_PER_PX, MASK_BOXES, RESID_E, RESID_N, px_to_lonlat

LEVELS = {  # código: (color RGB en el mapa, nivel)
    1: ((255, 0, 0), "muy_alto"),
    2: ((222, 158, 102), "alto"),
    3: ((255, 255, 0), "medio"),
    4: ((34, 139, 34), "bajo"),
}

MIN_AREA_PX = 1500   # descarta manchas pequeñas (símbolos, textos): ~3100 m²
CLOSE_PX = 25        # cierre morfológico para cubrir flechas, textos y calles
SIMPLIFY_PX = 1.4    # ~2 m


def main(png, out_geojson, preview=None):
    print(f"{M_PER_PX:.4f} m/px; residuo máx. del ajuste {RESID_N:.2f} m / {RESID_E:.2f} m")

    img = np.asarray(Image.open(png).convert("RGB")).astype(np.int16)
    h, w, _ = img.shape
    valid = np.zeros((h, w), np.uint8)
    x0, y0, x1, y1 = FRAME
    valid[y0 + 2:y1 - 1, x0 + 2:x1 - 1] = 1
    for bx0, by0, bx1, by1 in MASK_BOXES:
        valid[by0:by1, bx0:bx1] = 0

    # 1) Clasificación por color exacto
    label = np.zeros((h, w), np.uint8)
    for code, (rgb, _) in LEVELS.items():
        match = (np.abs(img - np.array(rgb)).sum(axis=2) <= 12) & (valid == 1)
        label[match] = code

    # 2) Quitar manchas pequeñas de cada color (símbolos, textos)
    for code in LEVELS:
        m = (label == code).astype(np.uint8)
        n, cc, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] < MIN_AREA_PX:
                label[cc == i] = 0

    # 3) Huella total de peligro: cierre + relleno de huecos
    any_h = (label > 0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CLOSE_PX, CLOSE_PX))
    foot = cv2.morphologyEx(any_h, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(foot, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    foot = np.zeros_like(foot)
    cv2.drawContours(foot, contours, -1, 1, thickness=cv2.FILLED)
    foot &= valid

    # 4) Asignar a cada píxel tapado el nivel del píxel clasificado más cercano
    unlabeled = (label == 0).astype(np.uint8)
    _, nearest = cv2.distanceTransformWithLabels(
        unlabeled, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    zero_coords = np.argwhere(unlabeled == 0)  # orden de índice de OpenCV (fila mayor)
    lut = np.zeros(len(zero_coords) + 1, np.uint8)
    lut[1:] = label[zero_coords[:, 0], zero_coords[:, 1]]
    filled = np.where(foot == 1, lut[nearest], 0).astype(np.uint8)

    # 5) Vectorizar por nivel
    features = []
    for code, (_, level) in LEVELS.items():
        m = (filled == code).astype(np.uint8)
        cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        if hier is None:
            continue
        hier = hier[0]
        polys = []
        for i, c in enumerate(cnts):
            if hier[i][3] != -1 or cv2.contourArea(c) < MIN_AREA_PX:
                continue
            rings = [c]
            child = hier[i][2]
            while child != -1:
                if cv2.contourArea(cnts[child]) >= 200:
                    rings.append(cnts[child])
                child = hier[child][0]
            poly = []
            for r in rings:
                r = cv2.approxPolyDP(r, SIMPLIFY_PX, True)
                if len(r) < 3:
                    continue
                ring = [px_to_lonlat(float(p[0][0]), float(p[0][1])) for p in r]
                ring.append(ring[0])
                poly.append(ring)
            if poly:
                polys.append(poly)
        area_m2 = float(m.sum()) * M_PER_PX ** 2
        features.append({
            "type": "Feature",
            "properties": {
                "nivel_peligro": level,
                "tipo_peligro": "aluvion",
                "escenario": "Aluvión desde la laguna Palcacocha (modelado)",
                "area_aprox_m2": round(area_m2),
                "fuente": "Mapa de zonas seguras y rutas de evacuación ante aluviones en Huaraz e Independencia – Zona baja, subcuenca río Quillcay",
                "institucion": "Municipalidad Provincial de Huaraz (OGRDyDC), INAIGEM, Municipalidad Distrital de Independencia",
                "fecha_fuente": "2025-05",
                "validacion": "Aprobado por la Plataforma Provincial de Defensa Civil de Huaraz, 26-05-2025",
                "url_fuente": "https://sinia.minam.gob.pe/mapas/mapa-zonas-seguras-rutas-evacuacion-ante-aluviones-huaraz-independencia",
                "metodo": "Digitalizado por el proyecto desde la imagen oficial (3508x2480 px), georreferenciado con la grilla UTM 18S del marco",
                "precision_aprox_m": 10,
                "estado_verificacion": "pendiente_revision_humana",
            },
            "geometry": {"type": "MultiPolygon", "coordinates": polys},
        })
        print(f"{level:9s} polígonos={len(polys):3d} área≈{area_m2/10000:7.2f} ha")

    cover = [px_to_lonlat(x, y) for x, y in [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]]
    out = {
        "type": "FeatureCollection",
        "name": "huaraz_zonas_peligro_aluvion_2025",
        "cobertura": {"type": "Polygon", "coordinates": [cover]},
        "features": features,
    }
    with open(out_geojson, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print("guardado", out_geojson)

    if preview:
        colors = {1: (255, 0, 0), 2: (222, 158, 102), 3: (255, 255, 0), 4: (34, 139, 34)}
        base = img.astype(np.uint8).copy()
        over = base.copy()
        for code, rgb in colors.items():
            over[filled == code] = rgb
        mix = (0.45 * base + 0.55 * over).astype(np.uint8)
        for code in LEVELS:
            m = (filled == code).astype(np.uint8)
            cnts, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(mix, cnts, -1, (0, 0, 0), 2)
        Image.fromarray(mix).save(preview)
        print("vista previa", preview)


if __name__ == "__main__":
    main(*sys.argv[1:4])
