"""Detecta las flechas de "ruta de evacuación priorizada" del mapa oficial de Huaraz.

En este mapa las rutas no son líneas: son flechas negras sobre las calles que
indican el sentido de evacuación. Cada flecha se guarda como un punto con su
rumbo (0° = norte, sentido horario).

Método: plantilla de la flecha "→" de la leyenda, escalada y rotada cada 10°,
con coincidencia normalizada sobre la máscara de píxeles oscuros. Se aplica
supresión de no-máximos para quedarse con una detección por flecha.

Uso: python scripts/etl/huaraz_flechas_evacuacion.py <png> <salida.geojson> [<vista_previa.png>] [<escala>]
"""

import json
import math
import sys

import cv2
import numpy as np
from PIL import Image

from huaraz_georef import FRAME, MASK_BOXES, px_to_lonlat

LEGEND_ARROW = (440, 1355, 495, 1395)  # flecha "→" de la leyenda (x0, y0, x1, y1)
THRESH = 0.62
NMS_PX = 14


def main(png, out_path, preview=None, scale=None):
    rgb = np.asarray(Image.open(png).convert("RGB"))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    valid = np.zeros(gray.shape, np.uint8)
    x0, y0, x1, y1 = FRAME
    valid[y0 + 2:y1 - 1, x0 + 2:x1 - 1] = 1
    for bx0, by0, bx1, by1 in MASK_BOXES:
        valid[by0:by1, bx0:bx1] = 0

    # Las flechas son negras (con halo blanco dentro de las zonas de peligro).
    # Se usa "negro verdadero" (los tres canales oscuros): en escala de grises
    # el rojo puro de la zona de peligro también parecería oscuro.
    ink = (rgb.max(axis=2) < 100).astype(np.uint8)
    search = (ink * valid).astype(np.float32)

    lx0, ly0, lx1, ly1 = LEGEND_ARROW
    tpl = (gray[ly0:ly1, lx0:lx1] < 90).astype(np.uint8)
    ys, xs = np.nonzero(tpl)
    tpl = tpl[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

    scales = [float(scale)] if scale else [0.28, 0.31, 0.34, 0.37]
    best = None
    for s in scales:
        t = cv2.resize(tpl.astype(np.float32), None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        side = int(math.ceil(math.hypot(*t.shape))) + 4
        pad = np.zeros((side, side), np.float32)
        oy, ox = (side - t.shape[0]) // 2, (side - t.shape[1]) // 2
        pad[oy:oy + t.shape[0], ox:ox + t.shape[1]] = t
        score = np.full(search.shape, -1.0, np.float32)
        angle = np.zeros(search.shape, np.int16)
        for a in range(0, 360, 10):
            # la plantilla apunta hacia la derecha (+x de la imagen)
            m = cv2.getRotationMatrix2D((side / 2, side / 2), a, 1.0)
            r = cv2.warpAffine(pad, m, (side, side), flags=cv2.INTER_LINEAR)
            res = cv2.matchTemplate(search, r, cv2.TM_CCOEFF_NORMED)
            full = np.full(search.shape, -1.0, np.float32)
            full[side // 2:side // 2 + res.shape[0], side // 2:side // 2 + res.shape[1]] = res
            upd = full > score
            score[upd] = full[upd]
            angle[upd] = a
        # supresión de no-máximos
        dil = cv2.dilate(score, np.ones((NMS_PX, NMS_PX), np.uint8))
        peaks = np.argwhere((score == dil) & (score >= THRESH))
        print(f"escala {s:.2f}: {len(peaks)} flechas (umbral {THRESH})")
        if best is None or len(peaks) > len(best[1]):
            best = (s, peaks, score, angle)

    s, peaks, score, angle = best
    features = []
    for y, x in peaks:
        a = int(angle[y, x])
        # ángulo en la imagen: 0° = hacia la derecha, antihorario (convención de OpenCV)
        img_dx, img_dy = math.cos(math.radians(a)), -math.sin(math.radians(a))
        # imagen -> terreno: +x de la imagen = sur (el norte apunta a la izquierda),
        # +y de la imagen = oeste (el este decrece hacia abajo)
        d_east, d_north = -img_dy, -img_dx
        bearing = (math.degrees(math.atan2(d_east, d_north)) + 360) % 360
        features.append({
            "type": "Feature",
            "properties": {
                "tipo": "flecha_evacuacion",
                "rumbo_grados": round(bearing),
                "confianza": round(float(score[y, x]), 2),
                "pixel": [int(x), int(y)],
                "fuente": "Mapa de zonas seguras y rutas de evacuación ante aluviones en Huaraz e Independencia – Zona baja, subcuenca río Quillcay",
                "institucion": "Municipalidad Provincial de Huaraz (OGRDyDC), INAIGEM, Municipalidad Distrital de Independencia",
                "fecha_fuente": "2025-05",
                "validacion": "Aprobado por la Plataforma Provincial de Defensa Civil de Huaraz, 26-05-2025",
                "metodo": "Detección automática de las flechas del mapa oficial georreferenciado",
                "estado_verificacion": "pendiente_revision_humana",
            },
            "geometry": {"type": "Point", "coordinates": px_to_lonlat(float(x), float(y))},
        })
    out = {"type": "FeatureCollection", "name": "huaraz_flechas_evacuacion_2025", "escala_plantilla": s, "features": features}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"elegida escala {s:.2f}: {len(features)} flechas -> {out_path}")

    if preview:
        vis = rgb.copy()
        for y, x in peaks:
            a = math.radians(int(angle[y, x]))
            p2 = (int(x + 22 * math.cos(a)), int(y - 22 * math.sin(a)))
            cv2.circle(vis, (int(x), int(y)), 11, (0, 160, 255), 2)
            cv2.line(vis, (int(x), int(y)), p2, (255, 0, 255), 3)
        Image.fromarray(vis).save(preview)


if __name__ == "__main__":
    main(*sys.argv[1:5])
