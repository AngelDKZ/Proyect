/**
 * "¿Puedo construir aquí?": junta los veredictos de todos los peligros, la pendiente y la distancia al río
 * en una de tres respuestas. Función pura, para poder probarla.
 *
 * - no_construir: el terreno mismo es el problema (orilla de río o quebrada, tierra débil, pendiente ≥ 25°).
 * - estudio: hay un peligro (p. ej. aluvión o inundación en la ciudad), pendiente fuerte, o no hay estudios del lugar.
 * - sin_peligros: lo evaluaron las fuentes y no encontraron peligros. Nunca decimos "seguro" ni "apto".
 */
import { colorNivel, INFO_PELIGRO, type Nivel, type Peligro, SIN_INFO_COLOR } from "./peligros";
import { CERCA_CAUCE_M, formatoDistancia, type Veredicto } from "./veredicto";

export type EstadoConstruccion = "no_construir" | "estudio" | "sin_peligros";

/** Clase de pendiente: 0 < 15°, 1 = 15–25°, 2 = 25–45°, 3 = > 45° (rangos del INGEMMET). */
export type ClasePendiente = 0 | 1 | 2 | 3;

export type Revision = { tema: string; color: string; texto: string };

export type EvaluacionConstruccion = {
  estado: EstadoConstruccion;
  titulo: string;
  razon: string;
  revisado: Revision[];
  acciones: string[];
};

export type DatosLugar = {
  veredictos: Record<Peligro, Veredicto>;
  pendiente: ClasePendiente;
  /** Distancia al cauce más cercano (null si no hay uno a menos de ~500 m). */
  cauce: { distanciaM: number; nombre: string | null } | null;
  /** ¿El punto está en una manzana del INEI analizada para todos los peligros? */
  conEstudios: boolean;
  /** Evento ya ocurrido (cualquier peligro) a menos de ~500 m: impide decir "sin peligros identificados". */
  eventoCercano?: { texto: string; distanciaM: number } | null;
};

const TEXTO_PENDIENTE: Record<ClasePendiente, string> = {
  0: "Suave (menos de 15°)",
  1: "Fuerte (15° a 25°)",
  2: "Muy fuerte (25° a 45°)",
  3: "Muy escarpada (más de 45°)",
};
const COLOR_PENDIENTE: Record<ClasePendiente, string> = { 0: "#eef2f5", 1: "#fb8c00", 2: "#e53935", 3: "#8e0000" };

export function evaluarConstruccion(d: DatosLugar): EvaluacionConstruccion {
  const v = d.veredictos;
  const motivos = (Object.values(v) as Veredicto[]).filter((x) => x.noConstruir).sort((a, b) => b.nivel - a.nivel);
  const conPeligro = (Object.values(v) as Veredicto[]).filter((x) => x.nivel >= 1).sort((a, b) => b.nivel - a.nivel);

  let estado: EstadoConstruccion;
  let razon: string;
  if (d.cauce && d.cauce.distanciaM <= CERCA_CAUCE_M) {
    // Orilla de un río o quebrada: la ley prohíbe viviendas en la faja marginal (su ancho lo fija la ANA por tramo).
    estado = "no_construir";
    razon =
      `Estás a ${formatoDistancia(d.cauce.distanciaM)} del cauce ${d.cauce.nombre ? `del ${d.cauce.nombre}` : "de una quebrada"}. ` +
      "En crecidas y huaicos el agua, el lodo y las piedras salen por el cauce y se llevan las orillas. Además, la ley prohíbe viviendas en la faja marginal de ríos y quebradas (Ley 29338).";
  } else if (motivos.length > 0) {
    estado = "no_construir";
    razon = motivos[0].noConstruir!;
  } else if (d.pendiente >= 2) {
    estado = "no_construir";
    razon = `La pendiente es ${TEXTO_PENDIENTE[d.pendiente].toLowerCase()}: en laderas así se originan deslizamientos y derrumbes.`;
  } else if (conPeligro.length > 0) {
    estado = "estudio";
    razon = `${conPeligro[0].titulo}. ${conPeligro[0].resumen}`.trim();
  } else if (d.pendiente === 1) {
    estado = "estudio";
    razon = "La pendiente es fuerte (15° a 25°): puede favorecer deslizamientos y la vivienda necesita un diseño especial.";
  } else if (d.eventoCercano) {
    estado = "estudio";
    razon = `A ${formatoDistancia(d.eventoCercano.distanciaM)} ya ocurrió: ${d.eventoCercano.texto}`;
  } else if (!d.conEstudios) {
    estado = "estudio";
    razon = "No hay estudios detallados de este lugar. Que no haya datos no significa que sea seguro.";
  } else {
    estado = "sin_peligros";
    razon = "Las fuentes oficiales evaluaron este lugar y no identificaron peligros.";
  }

  const titulo = { no_construir: "No construyas aquí", estudio: "Construye solo con estudio técnico", sin_peligros: "Sin peligros identificados" }[estado];

  const fila = (p: Peligro, tema = INFO_PELIGRO[p].corto): Revision => ({
    tema,
    color: colorNivel(p, v[p].nivel as Nivel),
    texto: v[p].titulo.replace(/^[^:]+:\s*/, "").replace(/^./, (c) => c.toUpperCase()),
  });

  const revisado: Revision[] = [
    fila("deslizamiento", "Tierra"),
    { tema: "Pendiente del terreno", color: COLOR_PENDIENTE[d.pendiente], texto: TEXTO_PENDIENTE[d.pendiente] },
    d.cauce
      ? {
          tema: "Río o quebrada",
          color: d.cauce.distanciaM <= CERCA_CAUCE_M ? "#e53935" : "#eef2f5",
          texto: `${d.cauce.nombre ?? "Quebrada"} a ${formatoDistancia(d.cauce.distanciaM)}`,
        }
      : { tema: "Río o quebrada", color: "#eef2f5", texto: "Ninguno a menos de 500 m" },
    fila("aluvion"),
    fila("huaico"),
    fila("inundacion_pluvial"),
    fila("caida"),
    fila("erosion"),
  ];
  for (const r of revisado) if (r.texto.startsWith("Sin información")) r.color = SIN_INFO_COLOR;

  const acciones: string[] = [];
  if (estado === "no_construir") acciones.push("Busca otro terreno fuera de esta zona.");
  if (v.deslizamiento.nivel >= 2 || d.pendiente >= 1)
    acciones.push("Si ya vives aquí: vigila grietas en el suelo y en las paredes; si aparecen, sal y avisa a la Municipalidad.");
  if (v.aluvion.nivel >= 1) acciones.push("Conoce tu ruta de evacuación ante aluvión y la zona segura más cercana.");
  acciones.push(
    estado === "sin_peligros"
      ? "Tramita la licencia de construcción en la Municipalidad."
      : "Pide a la Oficina de Gestión del Riesgo de la Municipalidad una evaluación del terreno.",
  );

  return { estado, titulo, razon, revisado, acciones };
}
