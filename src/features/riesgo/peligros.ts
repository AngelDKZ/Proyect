/** Peligros del piloto, con su escala de niveles y colores. Compartido por servidor y cliente. */

export const PELIGROS = ["inundacion_pluvial", "aluvion", "huaico", "deslizamiento", "caida", "erosion"] as const;
export type Peligro = (typeof PELIGROS)[number];

export function esPeligro(v: string): v is Peligro {
  return (PELIGROS as readonly string[]).includes(v);
}

/** -1 = evaluado sin peligro identificado · 0 = sin información · 1..4 = de menor a mayor. */
export type Nivel = -1 | 0 | 1 | 2 | 3 | 4;

export const SIN_INFO_COLOR = "#cfd4da";
export const EVALUADO_COLOR = "#eef2f5";

type Escala = Partial<Record<Exclude<Nivel, 0>, { color: string; texto: string }>>;

export const INFO_PELIGRO: Record<Peligro, { nombre: string; corto: string; descripcion: string; escala: Escala }> = {
  inundacion_pluvial: {
    nombre: "Inundación por lluvias",
    corto: "Inundación",
    descripcion: "Calles y viviendas que se inundan con lluvias intensas (diciembre a abril).",
    escala: {
      1: { color: "#ffcdd2", texto: "Registrada cerca o ubicación tentativa" },
      2: { color: "#ef5350", texto: "Zona crítica señalada o con inundaciones en el sector" },
      3: { color: "#b71c1c", texto: "Se ha inundado en este lugar" },
    },
  },
  aluvion: {
    nombre: "Aluvión",
    corto: "Aluvión",
    descripcion: "Desborde de la laguna Palcacocha: lodo y rocas bajan por el río Quillcay.",
    escala: {
      [-1]: { color: EVALUADO_COLOR, texto: "Evaluado, sin peligro identificado" },
      1: { color: "#fdd835", texto: "Peligro bajo" },
      2: { color: "#fb8c00", texto: "Peligro medio" },
      3: { color: "#e53935", texto: "Peligro alto" },
      4: { color: "#8e0000", texto: "Peligro muy alto" },
    },
  },
  huaico: {
    nombre: "Huaico",
    corto: "Huaico",
    descripcion: "Lodo y piedras que bajan por una quebrada, sobre todo con lluvias intensas.",
    escala: {
      2: { color: "#1565c0", texto: "Zona crítica del INGEMMET o camino aguas abajo de un huaico documentado" },
      4: { color: "#c62828", texto: "Ya bajó un huaico aquí" },
    },
  },
  deslizamiento: {
    nombre: "Deslizamiento",
    corto: "Deslizamiento",
    descripcion: "Una parte de la ladera se desliza cerro abajo, sobre todo con lluvias.",
    escala: {
      [-1]: { color: EVALUADO_COLOR, texto: "Evaluado, terreno poco propenso a moverse" },
      1: { color: "#ffe082", texto: "Terreno medianamente propenso o deslizamiento registrado cerca" },
      2: { color: "#fb8c00", texto: "Terreno muy propenso, zona crítica o deslizamiento ocurrido" },
      3: { color: "#e53935", texto: "Terreno extremadamente propenso" },
      4: { color: "#8e0000", texto: "Dentro de un deslizamiento medido" },
    },
  },
  caida: {
    nombre: "Caída de rocas",
    corto: "Caída de rocas",
    descripcion: "Rocas o bloques que se desprenden de laderas empinadas.",
    escala: {
      1: { color: "#ffe0b2", texto: "Registrada cerca" },
      2: { color: "#fb8c00", texto: "Ya ocurrió aquí o es zona crítica" },
      4: { color: "#8e0000", texto: "Dentro de un área de caída evaluada" },
    },
  },
  erosion: {
    nombre: "Erosión",
    corto: "Erosión",
    descripcion: "El agua desgasta la ladera o las orillas de los ríos y debilita el terreno.",
    escala: {
      1: { color: "#ffe0b2", texto: "Registrada cerca" },
      2: { color: "#fb8c00", texto: "Ya ocurrió aquí o es zona crítica" },
      4: { color: "#8e0000", texto: "Dentro de un área de erosión evaluada" },
    },
  },
};

export function colorNivel(peligro: Peligro, nivel: Nivel): string {
  if (nivel === 0) return SIN_INFO_COLOR;
  return INFO_PELIGRO[peligro].escala[nivel]?.color ?? SIN_INFO_COLOR;
}

export function textoNivel(peligro: Peligro, nivel: Nivel): string {
  if (nivel === 0) return "Sin información";
  return INFO_PELIGRO[peligro].escala[nivel]?.texto ?? "Sin información";
}
