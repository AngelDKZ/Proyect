"""Detecta los íconos de zonas seguras y puntos de atención del mapa oficial de Huaraz.

Detecta cada ícono como una mancha del color dominante de su tipo, con forma y
tamaño de cabeza de "pin". Devuelve la punta del pin (el lugar señalado) en
píxeles y genera recortes para revisarlos a mano.

Uso: python scripts/etl/huaraz_detectar_iconos.py <png> <salida.json> <dir_recortes>
"""

import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

# Color dominante del ícono en el mapa (RGB) y tolerancia (distancia L1)
TYPES = {
    "centro_acopio": ((185, 95, 255), 60),
    "atencion_medica": ((235, 5, 20), 45),
    "puesto_comando": ((88, 12, 104), 45),
    "refugio_temporal": ((239, 192, 8), 50),
    "zona_seguridad": ((7, 90, 46), 40),
    "atencion_animal": ((55, 189, 180), 60),
    "gestion_cadaveres": ((4, 4, 2), 30),
}

FRAME = (39, 56, 3451, 2441)
MASK_BOXES = [
    (90, 85, 1275, 600), (90, 600, 566, 2160), (580, 600, 840, 860),
    (2770, 1755, 3400, 2400), (2990, 130, 3330, 290), (260, 2290, 680, 2390),
]


def main(png, out_json, crops_dir):
    img = np.asarray(Image.open(png).convert("RGB")).astype(np.int16)
    h, w, _ = img.shape
    valid = np.zeros((h, w), np.uint8)
    x0, y0, x1, y1 = FRAME
    valid[y0 + 2:y1 - 1, x0 + 2:x1 - 1] = 1
    for bx0, by0, bx1, by1 in MASK_BOXES:
        valid[by0:by1, bx0:bx1] = 0

    os.makedirs(crops_dir, exist_ok=True)
    found = []
    for name, (rgb, tol) in TYPES.items():
        m = ((np.abs(img - np.array(rgb)).sum(axis=2) <= tol) & (valid == 1)).astype(np.uint8)
        # unir partes de la cabeza separadas por el pictograma blanco
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        n, cc, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
        for i in range(1, n):
            x, y, bw, bh, area = st[i]
            if not (28 <= bw <= 62 and 28 <= bh <= 75):
                continue
            # relleno de la silueta (el color puede formar solo un anillo
            # alrededor del pictograma interior)
            comp = (cc[y:y + bh, x:x + bw] == i).astype(np.uint8)
            cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            solid = max(cv2.contourArea(c) for c in cnts)
            fill = solid / float(bw * bh)
            if fill < 0.45:
                continue
            # la punta del pin: píxel más bajo de la mancha, en su columna central
            ys, xs = np.nonzero(cc[y:y + bh, x:x + bw] == i)
            tip_y = int(y + ys.max())
            tip_x = int(round(x + xs[ys >= ys.max() - 2].mean()))
            found.append({"id": len(found), "tipo": name, "bbox": [int(x), int(y), int(bw), int(bh)],
                          "punta_px": [tip_x, tip_y], "relleno": round(fill, 2)})
    # El negro también aparece dentro de otros íconos (siluetas, techos):
    # descartar detecciones negras que se superponen con un ícono de color.
    def overlaps(a, b):
        ax, ay, aw, ah = a["bbox"]
        bx, by, bw2, bh2 = b["bbox"]
        return ax < bx + bw2 and bx < ax + aw and ay < by + bh2 and by < ay + ah
    colored = [d for d in found if d["tipo"] != "gestion_cadaveres"]
    found = [d for d in found if d["tipo"] != "gestion_cadaveres"
             or not any(overlaps(d, c) for c in colored)]
    for i, d in enumerate(found):
        d["id"] = i
        x, y, bw, bh = d["bbox"]
        crop = img[max(0, y - 45):y + bh + 45, max(0, x - 70):x + bw + 70].astype(np.uint8)
        Image.fromarray(crop).resize((crop.shape[1] * 2, crop.shape[0] * 2), Image.NEAREST).save(
            os.path.join(crops_dir, f"{i:03d}_{d['tipo']}.png"))
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(found, f, ensure_ascii=False, indent=1)
    counts = {}
    for d in found:
        counts[d["tipo"]] = counts.get(d["tipo"], 0) + 1
    print(counts, "total", len(found))


if __name__ == "__main__":
    main(*sys.argv[1:4])
