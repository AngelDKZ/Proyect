/**
 * "¿Cada cuánto pasa?": cuántos años tuvieron eventos registrados, en pocas palabras.
 * Nunca un porcentaje: ninguna fuente publica probabilidades para estos lugares.
 */
import type { Peligro } from "./peligros";

export type Frecuencia = { texto: string; nota?: string };

const NOTA = "Según reportes; puede haber más. Sobre todo en temporada de lluvias.";

/** `anios`: años (desde 2018) con eventos registrados de ese peligro; `actual`: año en curso. */
export function frecuencia(peligro: Peligro, anios: number[], actual: number): Frecuencia {
  if (peligro === "aluvion")
    return { texto: "Gran aluvión del Quillcay: 1941. Desbordes de lagunas pequeñas en la quebrada Llaca: 2025." };
  const unicos = [...new Set(anios)].filter((a) => a <= actual).sort();
  if (unicos.length === 0) return { texto: "Sin eventos registrados desde 2018.", nota: NOTA };
  const ventana = actual - unicos[0] + 1;
  const n = unicos.length;
  const texto =
    n === ventana
      ? `Todos los años desde ${unicos[0]}.`
      : n / ventana >= 0.5
        ? `Casi todos los años: ${n} de los últimos ${ventana}.`
        : `Algunos años: ${n} de los últimos ${ventana}.`;
  return { texto, nota: NOTA };
}
