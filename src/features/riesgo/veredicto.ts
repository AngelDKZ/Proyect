/**
 * Convierte lo que hay alrededor de un punto en una respuesta clara:
 * 1) veredicto en una línea con su nivel, 2) qué hacer, 3) detalle con fuentes.
 *
 * Es una función pura (sin base de datos) para poder probarla.
 * Regla de oro: nunca decir "seguro". Distinguir "sin peligro identificado" de "sin información".
 */
import { type Nivel, type Peligro, INFO_PELIGRO, textoNivel } from "./peligros";

/** Algo encontrado cerca del punto (lo produce la consulta espacial). */
export type Hallazgo = {
  peligro: Peligro;
  categoria:
    | "zona_modelada"
    | "area_evaluada"
    | "evento_registrado"
    | "zona_critica"
    | "susceptibilidad"
    | "sector_expuesto"
    | "aniego_recurrente"
    | "cauce"
    | "pendiente"
    | "zona_inicio"
    | "camino_aguas_abajo";
  nivel: number | null; // nivel de la fuente (1..4 aluvión, 1..5 susceptibilidad)
  dentro: boolean; // el punto cae dentro del área (o del radio aproximado)
  distanciaM: number; // distancia al elemento (0 si está dentro)
  confianza: "alta" | "media" | "baja";
  texto: string; // descripción corta para el detalle
  fuente: string;
  fecha?: string | null;
  enlace?: string | null;
  nombre?: string | null; // nombre del río o quebrada (solo cauces)
};

export type ZonaSeguraCercana = {
  nombre: string;
  tipo: string;
  distanciaM: number;
  coordenadas: [number, number];
};

export type Veredicto = {
  peligro: Peligro;
  nivel: Nivel;
  titulo: string; // la respuesta en una línea
  resumen: string; // una frase que explica el porqué en lenguaje simple
  acciones: string[];
  detalle: Hallazgo[];
  dentroDeCobertura: boolean; // ¿alguna fuente evaluó este lugar para este peligro?
  noConstruir: string | null; // por qué no conviene construir aquí (null si no hay motivo fuerte)
};

export const RADIO_CERCA_M = 150;
/** Cercanía a un río o quebrada que se trata como peligro de huaico (orillas = faja marginal). */
export const CERCA_CAUCE_M = 50;
/** Categorías que, a ≤ RADIO_CERCA_M, dan "registrado cerca" (nivel 1) en los peligros distintos de aluvión y huaico. */
export const CATEGORIAS_CERCA: Hallazgo["categoria"][] = [
  "evento_registrado",
  "aniego_recurrente",
  "area_evaluada",
  "zona_critica",
  "sector_expuesto",
];

/** Nivel que aporta un elemento cuando el punto está dentro de él (también sirve para colorear el mapa). */
export function nivelElemento(
  h: Pick<Hallazgo, "peligro" | "categoria" | "nivel" | "confianza">,
): Nivel {
  if (h.peligro === "aluvion") return (h.nivel ?? 0) as Nivel;
  switch (h.categoria) {
    case "area_evaluada":
      return 4;
    case "aniego_recurrente":
      return 3;
    case "evento_registrado":
      if (h.peligro === "huaico") return 4; // solo hechos: por aquí ya bajó un huaico
      return h.peligro === "inundacion_pluvial" && h.confianza === "alta"
        ? 3
        : 2;
    case "sector_expuesto":
      // En huaico es una zona crítica oficial (Municipalidad): siempre nivel 2.
      return h.peligro === "huaico" ? 2 : h.confianza === "baja" ? 1 : 2;
    case "zona_critica":
    case "camino_aguas_abajo":
      return 2;

    case "cauce":
      return 0; // un río por sí solo no es un nivel de peligro; su distancia se usa en "¿Puedo construir aquí?"
    case "susceptibilidad": {
      const v = h.nivel ?? 0;
      return v >= 5 ? 3 : v === 4 ? 2 : v === 3 ? 1 : -1;
    }
    default:
      return 0;
  }
}

function nivelDe(h: Hallazgo): Nivel {
  return h.dentro ? nivelElemento(h) : 0;
}

function fraseNivel(
  peligro: Peligro,
  nivel: Nivel,
  cobertura: boolean,
): string {
  if (nivel !== 0)
    return `${INFO_PELIGRO[peligro].corto}: ${minusculaInicial(textoNivel(peligro, nivel))}`;
  return cobertura
    ? `${INFO_PELIGRO[peligro].corto}: sin peligro identificado aquí`
    : `${INFO_PELIGRO[peligro].corto}: sin información para este lugar`;
}

export function construirVeredicto(
  peligro: Peligro,
  hallazgos: Hallazgo[],
  opciones: {
    dentroDeCobertura?: boolean;
    zonaSegura?: ZonaSeguraCercana | null;
    /** Nivel de la manzana del INEI donde cae el punto (el mapa la colorea entera si una parte toca la zona). */
    manzana?: { nivel: number; detalle: string[] } | null;
  } = {},
): Veredicto {
  const propios = hallazgos.filter((h) => h.peligro === peligro);
  let nivel: Nivel = 0;
  for (const h of propios) {
    const n = nivelDe(h);
    if (n > nivel || (nivel === 0 && n === -1)) nivel = n;
  }
  const cobertura = opciones.dentroDeCobertura ?? propios.some((h) => h.dentro);
  if (nivel === 0 && cobertura && peligro === "aluvion") nivel = -1;

  // Registros cercanos (no en el punto): "registrado a X m", nivel 1.
  // No aplica al aluvión (su mapa oficial ya delimita las zonas) ni al huaico: un huaico baja por su cauce, no en
  // círculo; lo que corresponde es el camino aguas abajo. El registro cercano igual aparece en "Ver por qué".
  const cercano =
    peligro !== "aluvion" && peligro !== "huaico" && nivel <= 0
      ? propios
          .filter((h) => !h.dentro && h.distanciaM <= RADIO_CERCA_M && CATEGORIAS_CERCA.includes(h.categoria))
          .sort((a, b) => a.distanciaM - b.distanciaM)[0]
      : undefined;
  if (cercano) nivel = 1;

  // Detalle: primero lo que está en el punto, luego lo cercano; nada más lejos que el radio de cercanía.
  // El mapa colorea la manzana entera si alguna parte toca la zona: la tarjeta no puede decir menos que su color.
  // El "no construyas" se decide solo con el punto exacto (nivelPunto), no con el resto de la manzana.
  const nivelPunto = nivel;
  const mz = opciones.manzana;
  const porManzana = !!mz && mz.nivel > 0 && mz.nivel > nivel;
  if (porManzana) nivel = mz!.nivel as Nivel;
  // Si la manzana fue evaluada sin peligro (-1) y el punto cae en un hueco de la capa, se informa igual que el mapa.
  if (mz && mz.nivel === -1 && nivel === 0) nivel = -1;

  const detalle = propios
    .filter((h) => h.dentro || (h.distanciaM <= RADIO_CERCA_M && h.categoria !== "pendiente" && h.categoria !== "cauce"))
    .sort(
      (a, b) =>
        Number(b.dentro) - Number(a.dentro) ||
        nivelDe(b) - nivelDe(a) ||
        a.distanciaM - b.distanciaM,
    );

  const resumen = porManzana
    ? `Parte de tu manzana: ${mz!.detalle.join(" · ") || textoNivel(peligro, nivel)}.`
    : cercano
      ? `A ${formatoDistancia(cercano.distanciaM)}: ${cercano.texto}`
      : nivel > 0
        ? (detalle.find((h) => h.dentro)?.texto ?? detalle[0]?.texto ?? "")
        : nivel === -1
          ? "Las fuentes oficiales evaluaron este lugar y no identificaron este peligro. No reemplaza una evaluación técnica."
          : "Ninguna fuente tiene datos de este lugar para este peligro. Que no haya datos no significa que sea seguro.";

  const acciones: string[] = [];
  const zs = opciones.zonaSegura;
  if (peligro === "aluvion" && nivel > 0) {
    acciones.push(
      "Si suena la alerta de aluvión, evacúa de inmediato siguiendo las flechas, hacia los costados del cauce.",
    );
    if (zs)
      acciones.push(
        `Zona de seguridad más cercana: ${zs.nombre} (${formatoDistancia(zs.distanciaM)} en línea recta).`,
      );
  }
  if (nivel > 0) {
    const especifica: Partial<Record<Peligro, string>> = {
      huaico:
        "En temporada de lluvias, aléjate del cauce de la quebrada y no cruces cuando baje agua con lodo.",
      inundacion_pluvial:
        "Antes de la temporada de lluvias, limpia canaletas y desagües, y protege la entrada de tu vivienda.",
      deslizamiento:
        "Si aparecen grietas en el terreno o en las paredes, sal de la vivienda y avisa a la Municipalidad.",
      caida:
        "No te detengas al pie de laderas con rocas sueltas, sobre todo con lluvias o después de un sismo.",
      erosion:
        "No construyas ni te acerques al borde del talud o de la orilla: las lluvias pueden socavarlo.",
    };
    if (especifica[peligro]) acciones.push(especifica[peligro]);
    if (zs && peligro === "huaico")
      acciones.push(`Lugar seguro más cercano, fuera de zonas de huaico: ${zs.nombre} (${formatoDistancia(zs.distanciaM)} en línea recta).`);
    if (zs && peligro === "inundacion_pluvial" && nivel >= 2)
      acciones.push(`Si tu vivienda se inunda, refugio temporal más cercano: ${zs.nombre} (${formatoDistancia(zs.distanciaM)} en línea recta).`);
  }
  const noConstruir = motivoNoConstruir(
    peligro,
    nivelPunto,
    detalle.find((h) => h.dentro),
  );

  // Aluvión ya ocurrido (p. ej. Llaca–Casca 2025) fuera del mapa oficial: se dice como hecho, no como "peligro muy alto".
  const aluvionOcurrido =
    peligro === "aluvion" && !porManzana
      ? propios.find((h) => h.dentro && h.categoria === "evento_registrado" && !propios.some((z) => z.dentro && z.categoria === "zona_modelada"))
      : undefined;

  return {
    peligro,
    nivel,
    titulo: aluvionOcurrido
      ? `Aluvión: ya bajó un aluvión aquí${aluvionOcurrido.fecha ? ` (${aluvionOcurrido.fecha})` : ""}`
      : porManzana
      ? `${INFO_PELIGRO[peligro].corto}: ${minusculaInicial(textoNivel(peligro, nivel))} en parte de tu manzana`
      : cercano
        ? `${INFO_PELIGRO[peligro].corto}: registrado a ${formatoDistancia(cercano.distanciaM)}`
        : fraseNivel(peligro, nivel, cobertura),
    resumen,
    acciones,
    detalle,
    dentroDeCobertura: cobertura,
    noConstruir,
  };
}

/**
 * "No construyas aquí" solo donde el terreno mismo es el problema: orillas de ríos y quebradas
 * y tierra débil (deslizada, muy propensa, con caída de rocas o erosión). En la ciudad consolidada
 * (zonas de aluvión, recorrido de huaicos, calles que se inundan) solo se informa el peligro.
 * No damos probabilidades numéricas: las fuentes dan niveles, no porcentajes.
 */
function motivoNoConstruir(
  peligro: Peligro,
  nivel: Nivel,
  principal: Hallazgo | undefined,
): string | null {
  if (nivel < 3) return null;
  switch (peligro) {
    case "huaico":
      return `Por aquí ya bajó un huaico${principal?.fecha ? ` (${principal.fecha})` : ""}: la quebrada puede volver a activarse con lluvias intensas.`;
    case "deslizamiento":
      return principal?.categoria === "area_evaluada"
        ? "El terreno ya se deslizó (área medida por el INGEMMET): es tierra inestable que puede volver a moverse con lluvias o sismos."
        : "El terreno es extremadamente propenso a deslizarse por el tipo de suelo y roca y por la pendiente (INGEMMET): es tierra débil para cimentar.";
    case "caida":
      return "Está en un área donde caen rocas desde la ladera (evaluada por el INGEMMET): un bloque puede golpear la vivienda.";
    case "erosion":
      return "El agua está desgastando este terreno (área evaluada por el INGEMMET): el suelo puede ceder bajo la vivienda.";
    default:
      return null; // aluvión e inundación en la ciudad: se informa el peligro, sin prohibir.
  }
}

export function formatoDistancia(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** "Zona crítica oficial (Municipalidad…)" → "zona crítica oficial (Municipalidad…)": respeta siglas y nombres propios. */
function minusculaInicial(t: string): string {
  return t.charAt(0).toLowerCase() + t.slice(1);
}
