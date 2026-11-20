/**
 * Normaliza nombres para buscar sin importar tildes, mayúsculas ni abreviaturas
 * ("Jr. Aija" encuentra "Jirón Aija"). Compartido por el cargador de datos y la API.
 */
const ABREVIATURAS: Record<string, string> = {
  jr: "jiron",
  av: "avenida",
  avda: "avenida",
  psje: "pasaje",
  pje: "pasaje",
  urb: "urbanizacion",
  ca: "calle",
  cl: "calle",
  aa: "asentamiento",
  hh: "humano",
  ie: "institucion",
  pp: "pueblo",
  jj: "joven",
};

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => ABREVIATURAS[p] ?? p)
    .join(" ");
}

/** Palabras de la búsqueda (todas deben aparecer en el nombre). */
export function palabrasDeBusqueda(q: string): string[] {
  return normalizar(q).split(" ").filter((p) => p.length > 0).slice(0, 6);
}
