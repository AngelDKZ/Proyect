"""Georreferenciación compartida del mapa oficial de Huaraz e Independencia (mayo 2025).

Imagen: data/raw/huaraz/mapa_zonas_seguras_2025.png (3508 x 2480 px).
Sistema del mapa: WGS84 / UTM zona 18 Sur (EPSG:32718). El mapa está girado 90°:
el norte apunta a la izquierda, así que el eje X de la imagen corresponde a la
coordenada Norte y el eje Y a la coordenada Este.

Las marcas se midieron en el marco de la imagen (las mismas arriba/abajo y a
izquierda/derecha). Residuo máximo del ajuste: 0,64 m. Escala: 1,44 m por píxel.
Validación contra OpenStreetMap: el cauce del río Quillcay coincide con un
desplazamiento medio menor a 2 m.
"""

import numpy as np
from pyproj import Transformer

TICKS_X_NORTE = [(259.0, 8948100), (884.0, 8947200), (1510.0, 8946300),
                 (2135.0, 8945400), (2760.0, 8944500), (3385.0, 8943600)]
TICKS_Y_ESTE = [(315.0, 224400), (940.0, 223500), (1566.0, 222600), (2191.0, 221700)]

FRAME = (39, 56, 3451, 2441)  # x0, y0, x1, y1 del marco del mapa

# Zonas de la imagen que no son mapa
MASK_BOXES = [
    (90, 85, 1275, 600),       # título y logos
    (90, 600, 566, 2160),      # leyenda de zonas seguras, rutas y usos
    (580, 600, 840, 860),      # leyenda "Nivel de peligro"
    (2770, 1755, 3400, 2400),  # cuadro de autoridades, escala y fuentes
    (2990, 130, 3330, 290),    # flecha del norte
    (260, 2290, 680, 2390),    # barra de escala
]


def _fit(ticks):
    px = np.array([t[0] for t in ticks])
    utm = np.array([t[1] for t in ticks])
    slope, intercept = np.polyfit(px, utm, 1)
    resid = float(np.abs(utm - (slope * px + intercept)).max())
    return float(slope), float(intercept), resid


SN, BN, RESID_N = _fit(TICKS_X_NORTE)
SE, BE, RESID_E = _fit(TICKS_Y_ESTE)
M_PER_PX = (abs(SN) + abs(SE)) / 2

_TO_WGS = Transformer.from_crs("EPSG:32718", "EPSG:4326", always_xy=True)


def px_to_utm(x, y):
    """Píxel de la imagen -> (Este, Norte) en EPSG:32718."""
    return SE * y + BE, SN * x + BN


def px_to_lonlat(x, y):
    """Píxel de la imagen -> [lon, lat] en EPSG:4326, redondeado a ~1 cm."""
    lon, lat = _TO_WGS.transform(*px_to_utm(x, y))
    return [round(lon, 7), round(lat, 7)]
