/**
 * Rutas a pie sobre las calles (función pura, sin base de datos, para poder probarla).
 *
 * - Grafo: cada tramo recto de calle es una arista; los extremos que coinciden son el mismo nodo.
 * - Costo: largo del tramo; si cruza una zona de peligro del peligro elegido se multiplica por PENALIDAD,
 *   para que la ruta salga de la zona lo antes posible (en aluvión: hacia los costados del cauce).
 * - Destinos: varios posibles (p. ej. todos los lugares seguros válidos); se llega al de menor costo.
 */

export type Tramo = { ax: number; ay: number; bx: number; by: number; largo: number; peligroso: boolean; calle: string | null };
export type Destino<T> = { lon: number; lat: number; dato: T };
export type Paso = { texto: string; metros: number };
export type Ruta<T> = {
  destino: T;
  metros: number;
  minutos: number;
  /** Metros caminando hasta salir de la zona de peligro (0 si ya estás fuera). */
  metrosHastaSalir: number;
  coordenadas: [number, number][];
  pasos: Paso[];
};

export const PENALIDAD = 4;
/** 4,2 km/h: paso de una persona caminando con apuro, en subida suave. */
export const METROS_POR_MINUTO = 70;
const MAX_ACCESO_M = 300;

type Arista = { a: number; b: number; largo: number; peligroso: boolean; calle: string | null };

export class Grafo {
  readonly x: number[] = [];
  readonly y: number[] = [];
  private indice = new Map<string, number>();
  private ady: Arista[][] = [];

  constructor(tramos: Tramo[]) {
    for (const t of tramos) {
      const a = this.nodo(t.ax, t.ay), b = this.nodo(t.bx, t.by);
      if (a === b) continue;
      const e: Arista = { a, b, largo: t.largo, peligroso: t.peligroso, calle: t.calle };
      this.ady[a].push(e);
      this.ady[b].push(e);
    }
  }

  private nodo(x: number, y: number): number {
    const k = `${x.toFixed(6)},${y.toFixed(6)}`;
    let i = this.indice.get(k);
    if (i === undefined) {
      i = this.x.length;
      this.indice.set(k, i);
      this.x.push(x);
      this.y.push(y);
      this.ady.push([]);
    }
    return i;
  }

  get nodos() {
    return this.x.length;
  }

  /** Nodo más cercano a un punto, con su distancia en metros (aprox. equirectangular). */
  cercano(lon: number, lat: number): { nodo: number; metros: number } {
    let mejor = -1, d2 = Infinity;
    const k = Math.cos((lat * Math.PI) / 180);
    for (let i = 0; i < this.x.length; i++) {
      const dx = (this.x[i] - lon) * k, dy = this.y[i] - lat;
      const d = dx * dx + dy * dy;
      if (d < d2) [d2, mejor] = [d, i];
    }
    return { nodo: mejor, metros: Math.sqrt(d2) * 111_320 };
  }

  /** Ruta de menor costo desde (lon, lat) hasta el destino más conveniente. null si no hay calles cerca o no se llega. */
  ruta<T>(lon: number, lat: number, destinos: Destino<T>[], conPeligro = true): Ruta<T> | null {
    const origen = this.cercano(lon, lat);
    if (origen.nodo < 0 || origen.metros > MAX_ACCESO_M) return null;
    const meta = new Map<number, T>();
    for (const d of destinos) {
      const c = this.cercano(d.lon, d.lat);
      if (c.metros <= MAX_ACCESO_M && !meta.has(c.nodo)) meta.set(c.nodo, d.dato);
    }
    if (meta.size === 0) return null;

    const costo = new Float64Array(this.nodos).fill(Infinity);
    const previa: (Arista | undefined)[] = new Array(this.nodos);
    const cola = new Monticulo(costo);
    costo[origen.nodo] = 0;
    cola.push(origen.nodo);
    let llegada = -1;
    while (cola.size > 0) {
      const u = cola.pop();
      if (meta.has(u)) {
        llegada = u;
        break;
      }
      for (const e of this.ady[u]) {
        const v = e.a === u ? e.b : e.a;
        const c = costo[u] + e.largo * (conPeligro && e.peligroso ? PENALIDAD : 1);
        if (c < costo[v]) {
          costo[v] = c;
          previa[v] = e;
          cola.push(v);
        }
      }
    }
    if (llegada < 0) return null;

    // Reconstruir el camino (del origen a la llegada).
    const aristas: { e: Arista; desde: number; hasta: number }[] = [];
    for (let v = llegada; v !== origen.nodo; ) {
      const e = previa[v]!;
      const u = e.a === v ? e.b : e.a;
      aristas.push({ e, desde: u, hasta: v });
      v = u;
    }
    aristas.reverse();
    const coordenadas: [number, number][] = [[this.x[origen.nodo], this.y[origen.nodo]]];
    for (const a of aristas) coordenadas.push([this.x[a.hasta], this.y[a.hasta]]);
    const metros = aristas.reduce((s, a) => s + a.e.largo, 0);
    let metrosHastaSalir = 0;
    if (aristas[0]?.e.peligroso) {
      for (const a of aristas) {
        if (!a.e.peligroso) break;
        metrosHastaSalir += a.e.largo;
      }
    }
    return {
      destino: meta.get(llegada)!,
      metros: Math.round(metros),
      minutos: Math.max(1, Math.ceil(metros / METROS_POR_MINUTO)),
      metrosHastaSalir: Math.round(metrosHastaSalir),
      coordenadas,
      pasos: pasos(aristas.map((a) => ({ calle: a.e.calle, largo: a.e.largo, x1: this.x[a.desde], y1: this.y[a.desde], x2: this.x[a.hasta], y2: this.y[a.hasta] }))),
    };
  }
}

type TramoRuta = { calle: string | null; largo: number; x1: number; y1: number; x2: number; y2: number };

function rumbo(t: TramoRuta): number {
  const k = Math.cos((t.y1 * Math.PI) / 180);
  return (Math.atan2((t.x2 - t.x1) * k, t.y2 - t.y1) * 180) / Math.PI;
}

const redondeo = (m: number) => (m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50);

/** Indicaciones cortas: se agrupan los tramos por calle y se dice hacia dónde girar al cambiar de calle. */
export function pasos(tramos: TramoRuta[]): Paso[] {
  const grupos: { calle: string | null; largo: number; inicio: TramoRuta; fin: TramoRuta }[] = [];
  for (const t of tramos) {
    const g = grupos.at(-1);
    if (g && g.calle === t.calle) {
      g.largo += t.largo;
      g.fin = t;
    } else grupos.push({ calle: t.calle, largo: t.largo, inicio: t, fin: t });
  }
  // Tramos muy cortos (cruces, esquinas) se unen al anterior para no dar indicaciones de 5 m.
  const limpios = grupos.filter((g, i) => g.largo >= 25 || i === 0 || i === grupos.length - 1);
  const salida: Paso[] = [];
  limpios.forEach((g, i) => {
    const nombre = g.calle ?? "una calle sin nombre";
    const m = redondeo(g.largo);
    if (i === 0) {
      salida.push({ texto: `Camina por ${nombre} ${m} m.`, metros: g.largo });
      return;
    }
    let giro = rumbo(g.inicio) - rumbo(limpios[i - 1].fin);
    giro = ((giro + 540) % 360) - 180;
    const accion = giro > 30 ? "Gira a la derecha en" : giro < -30 ? "Gira a la izquierda en" : "Sigue por";
    salida.push({ texto: `${accion} ${nombre} y avanza ${m} m.`, metros: g.largo });
  });
  return salida.slice(0, 10);
}

/** Montículo mínimo por costo. */
class Monticulo {
  private a: number[] = [];
  constructor(private costo: Float64Array) {}
  get size() {
    return this.a.length;
  }
  push(i: number) {
    const a = this.a;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.costo[a[p]] <= this.costo[a[k]]) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < a.length && this.costo[a[l]] < this.costo[a[m]]) m = l;
        if (r < a.length && this.costo[a[r]] < this.costo[a[m]]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top;
  }
}
