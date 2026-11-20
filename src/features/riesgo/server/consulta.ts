/**
 * Servicio de consulta de un punto: une las consultas espaciales con la regla del veredicto.
 */
import { type ClasePendiente, evaluarConstruccion, type EvaluacionConstruccion } from "../construccion";
import { type Frecuencia, frecuencia } from "../frecuencia";
import { PELIGROS, type Peligro } from "../peligros";
import { construirVeredicto, type Hallazgo, type Veredicto } from "../veredicto";
import { aniosConEventos, coberturaEn, elementosCercanos, manzanaEn, zonaSeguraMasCercana, type FilaCercana } from "./repositorio";


const NOMBRE_TIPO: Record<string, string> = {
  zona_seguridad: "Zona de seguridad",
  refugio_temporal: "Refugio temporal",
};

/** Propiedades que guarda el cargador en `hazard_features.properties` (todas opcionales). */
type Props = Partial<{
  tipo: string; sector: string; lugar: string; zona: string; paraje: string; peligros: string; nombre: string;
  sinpad: string; descripcion: string; eventos: { fecha: string; url?: string }[];
  fuentes: { url?: string; medio?: string }[]; es_recorrido: boolean; origen: string; tipo_origen: string;
}>;

/** Texto corto y comprensible para cada elemento encontrado. */
function textoDe(f: FilaCercana): string {
  const p = f.properties as Props;
  switch (f.categoria) {
    case "zona_modelada":
      return `Zona de peligro ${String(f.etiqueta ?? "").toLowerCase()} en el mapa oficial de aluvión (Quillcay, 2025).`;
    case "area_evaluada":
      return `Área de ${String(p.tipo ?? "peligro").toLowerCase()} evaluada por el INGEMMET${p.sector ? ` en ${p.sector}` : ""}.`;
    case "aniego_recurrente":
      return `${p.lugar}: aniegos recurrentes con lluvias (Contraloría, 2025).`;
    case "sector_expuesto":
      return `Sector ${p.sector}: zona crítica "${p.zona}" señalada por la Municipalidad (2025).`;
    case "zona_critica":
      return `Zona crítica del INGEMMET "${p.paraje}": ${String(p.peligros ?? "").toLowerCase()}.`;
    case "susceptibilidad":
      return `Terreno con susceptibilidad ${String(f.etiqueta ?? "").toLowerCase()} a moverse (INGEMMET, escala regional).`;
    case "camino_aguas_abajo":
      return `Camino aguas abajo de ${p.origen ?? "un huaico documentado"} (${String(p.tipo_origen ?? "").toLowerCase()}${f.fecha ? `, ${f.fecha}` : ""}): por aquí bajaría el lodo según el relieve.`;
    case "pendiente":
      return `Pendiente ${String(f.etiqueta ?? "").toLowerCase()} (modelo de elevación Copernicus, 30 m).`;
    case "cauce":
      return `Cauce ${p.nombre ? `del ${p.nombre}` : "de una quebrada"}: camino natural de los huaicos.`;
    case "evento_registrado": {
      if (Array.isArray(p.eventos)) {
        const n = p.eventos.length;
        return `${p.lugar}: se inundó ${n === 1 ? "1 vez" : `${n} veces`} según noticias (última: ${f.fecha}).`;
      }
      if (p.sinpad) return `Emergencia SINPAD en ${p.sector}: ${p.descripcion}`;
      if (p.fuentes) return `${p.es_recorrido ? "Recorrido del flujo de " : ""}${p.lugar} (${f.fecha}): ${p.descripcion}`;
      return `${p.tipo ?? "Peligro"} ya ocurrido aquí (INGEMMET${f.fecha ? `, ${f.fecha}` : ""}).`;
    }
    default:
      return f.dataset;
  }
}

function enlaceDe(f: FilaCercana): string | null {
  const p = f.properties as Props;
  if (Array.isArray(p.eventos) && p.eventos[0]?.url) return p.eventos[0].url;
  if (Array.isArray(p.fuentes) && p.fuentes[0]?.url) return p.fuentes[0].url;
  return f.url;
}

/** Convierte filas de la base en hallazgos. */
export function aHallazgos(filas: FilaCercana[]): Hallazgo[] {
  const out: Hallazgo[] = [];
  for (const f of filas) {
    const radio = f.radio_m ?? 0;
    const dentro = f.intersecta || (radio > 0 && f.distancia_m <= radio);
    const base: Hallazgo = {
      peligro: f.peligro,
      categoria: f.categoria as Hallazgo["categoria"],
      nivel: f.nivel,
      dentro,
      distanciaM: dentro ? 0 : Math.max(0, f.distancia_m - radio),
      confianza: f.confianza,
      texto: textoDe(f),
      fuente: `${f.institucion} – ${f.dataset}`,
      fecha: f.fecha,
      enlace: enlaceDe(f),
      nombre: f.categoria === "cauce" ? ((f.properties as Props).nombre ?? null) : null,
    };
    out.push(base);
  }
  return out;
}

export type ResultadoConsulta = {
  punto: [number, number];
  veredictos: Record<Peligro, Veredicto>;
  manzana: { id: string; zona: string; manzana: string; niveles: Record<string, number> } | null;
  frecuencia: Record<Peligro, Frecuencia>;
  construccion: EvaluacionConstruccion;
};

export async function consultarPunto(lon: number, lat: number): Promise<ResultadoConsulta> {
  const [filas, cobertura, zAluvion, zHuaico, zInundacion, manzana, anios] = await Promise.all([
    elementosCercanos(lon, lat),
    coberturaEn(lon, lat),
    zonaSeguraMasCercana(lon, lat, "aluvion"),
    zonaSeguraMasCercana(lon, lat, "huaico"),
    zonaSeguraMasCercana(lon, lat, "inundacion_pluvial"),
    manzanaEn(lon, lat),
    aniosConEventos(),
  ]);
  const hallazgos = aHallazgos(filas);
  type Z = Awaited<ReturnType<typeof zonaSeguraMasCercana>>;
  const aZona = (z: Z | null) =>
    z ? { nombre: z.nombre ?? `${NOMBRE_TIPO[z.tipo] ?? "Zona"} – ${z.referencia}`, tipo: z.tipo, distanciaM: z.distancia_m, coordenadas: [z.lon, z.lat] as [number, number] } : null;
  const zonas: Partial<Record<Peligro, Z | null>> = { aluvion: zAluvion, huaico: zHuaico, inundacion_pluvial: zInundacion };
  const veredictos = Object.fromEntries(
    PELIGROS.map((p) => [
      p,
      construirVeredicto(p, hallazgos, {
        dentroDeCobertura: cobertura.has(p) || hallazgos.some((h) => h.peligro === p && h.dentro),
        zonaSegura: aZona(zonas[p] ?? null),
        manzana: manzana ? { nivel: manzana.niveles[p] ?? 0, detalle: manzana.detalles?.[p] ?? [] } : null,
      }),
    ]),
  ) as Record<Peligro, Veredicto>;
  const pendiente = Math.max(0, ...hallazgos.filter((h) => h.categoria === "pendiente" && h.dentro).map((h) => h.nivel ?? 0)) as ClasePendiente;
  const cauce = hallazgos.filter((h) => h.categoria === "cauce").sort((a, b) => a.distanciaM - b.distanciaM)[0];
  const eventoCercano = hallazgos
    .filter((h) => (h.categoria === "evento_registrado" || h.categoria === "area_evaluada") && h.distanciaM <= 500)
    .sort((a, b) => a.distanciaM - b.distanciaM)[0];
  const construccion = evaluarConstruccion({
    veredictos,
    pendiente,
    cauce: cauce ? { distanciaM: cauce.distanciaM, nombre: cauce.nombre ?? null } : null,
    // El mapa de aluvión solo cubre el Quillcay: no basta para decir "sin peligros" de los demás.
    conEstudios: manzana !== null,
    eventoCercano: eventoCercano ? { texto: eventoCercano.texto, distanciaM: eventoCercano.distanciaM } : null,
  });
  const actual = new Date().getFullYear();
  const frecuencias = Object.fromEntries(PELIGROS.map((p) => [p, frecuencia(p, anios[p] ?? [], actual)])) as Record<Peligro, Frecuencia>;
  return { punto: [lon, lat], veredictos, manzana, frecuencia: frecuencias, construccion };
}
