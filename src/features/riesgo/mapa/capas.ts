/**
 * Estilos de las capas del mapa (expresiones de MapLibre). Sin dependencias de MapLibre en tiempo
 * de ejecución para poder probarlos en Node.
 */
import { colorNivel, INFO_PELIGRO, type Nivel, type Peligro, SIN_INFO_COLOR } from "../peligros";

export const ESTILO_BASE = "https://tiles.openfreemap.org/styles/liberty";
export const CENTRO_HUARAZ: [number, number] = [-77.528, -9.527];
/** Mismo recuadro que valida la API de consulta. */
export const LIMITES_PILOTO: [[number, number], [number, number]] = [
  [-77.75, -9.75],
  [-77.3, -9.3],
];

const NIVELES: Nivel[] = [-1, 1, 2, 3, 4];

/** Color de cada manzana según su nivel (-1..4) para el peligro elegido. */
export function colorManzanas(peligro: Peligro): unknown[] {
  return ["match", ["get", "nivel"], ...NIVELES.flatMap((n) => [n, colorNivel(peligro, n)]), SIN_INFO_COLOR];
}

/**
 * Metros → píxeles en pantalla a la latitud de Huaraz (≈ -9.5°), para dibujar radios aproximados.
 * A zoom z un píxel mide 156 543 · cos(lat) / 2^z metros; se interpola en base 2 entre z10 y z20.
 */
const M_POR_PX_Z10 = (156543.03 * Math.cos((9.53 * Math.PI) / 180)) / 2 ** 10;

export function metrosAPixeles(metros: unknown, minimoPx = 0): unknown[] {
  // MapLibre solo admite ["zoom"] en un interpolate de primer nivel: el mínimo va dentro de cada parada.
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    10,
    ["max", minimoPx, ["/", metros, M_POR_PX_Z10]],
    20,
    ["max", minimoPx, ["/", ["*", metros, 1024], M_POR_PX_Z10]],
  ];
}

/** Para la susceptibilidad regional (1..5 de la fuente), con los colores del nivel equivalente. */
export function colorSusceptibilidad(): unknown[] {
  return [
    "match",
    ["get", "nivel"],
    5,
    colorNivel("deslizamiento", 3),
    4,
    colorNivel("deslizamiento", 2),
    colorNivel("deslizamiento", 1),
  ];
}

/** Elementos de la leyenda de un peligro, de mayor a menor. */
export function leyenda(peligro: Peligro): { nivel: Nivel; color: string; texto: string }[] {
  const escala = INFO_PELIGRO[peligro].escala;
  const filas = ([4, 3, 2, 1, -1] as const)
    .filter((n) => escala[n])
    .map((n) => ({ nivel: n as Nivel, color: escala[n]!.color, texto: escala[n]!.texto }));
  return [...filas, { nivel: 0, color: SIN_INFO_COLOR, texto: "Sin información (no significa que sea seguro)" }];
}
