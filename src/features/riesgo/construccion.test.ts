import { describe, expect, it } from "vitest";
import { evaluarConstruccion, type DatosLugar } from "./construccion";
import { PELIGROS, type Peligro } from "./peligros";
import { construirVeredicto, type Hallazgo } from "./veredicto";

const h = (o: Partial<Hallazgo> & Pick<Hallazgo, "peligro" | "categoria">): Hallazgo => ({
  nivel: null,
  dentro: true,
  distanciaM: 0,
  confianza: "alta",
  texto: "texto",
  fuente: "fuente",
  ...o,
});

function lugar(hallazgos: Hallazgo[], extra: Partial<DatosLugar> = {}, cobertura: Peligro[] = []): DatosLugar {
  const veredictos = Object.fromEntries(
    PELIGROS.map((p) => [p, construirVeredicto(p, hallazgos, { dentroDeCobertura: cobertura.includes(p) || undefined })]),
  ) as DatosLugar["veredictos"];
  return { veredictos, pendiente: 0, cauce: null, conEstudios: true, ...extra };
}

describe("¿Puedo construir aquí?", () => {
  it("tierra que ya se deslizó: no construir, con la razón", () => {
    const e = evaluarConstruccion(lugar([h({ peligro: "deslizamiento", categoria: "area_evaluada" })]));
    expect(e.estado).toBe("no_construir");
    expect(e.titulo).toBe("No construyas aquí");
    expect(e.razon).toMatch(/ya se deslizó/);
    expect(e.acciones[0]).toBe("Busca otro terreno fuera de esta zona.");
  });

  it("pendiente de 25° o más: no construir aunque no haya otros datos", () => {
    const e = evaluarConstruccion(lugar([], { pendiente: 2, conEstudios: false }));
    expect(e.estado).toBe("no_construir");
    expect(e.razon).toMatch(/muy fuerte \(25° a 45°\)/);
  });

  it("aluvión en la ciudad: solo con estudio técnico, nunca 'no construyas'", () => {
    const e = evaluarConstruccion(lugar([h({ peligro: "aluvion", categoria: "zona_modelada", nivel: 4 })], {}, ["aluvion"]));
    expect(e.estado).toBe("estudio");
    expect(e.razon).toMatch(/^Aluvión: peligro muy alto/);
    expect(e.acciones.join(" ")).toMatch(/ruta de evacuación/);
  });

  it("cerro sin estudios ni peligros conocidos: estudio técnico, no 'sin peligros'", () => {
    const e = evaluarConstruccion(lugar([], { conEstudios: false }));
    expect(e.estado).toBe("estudio");
    expect(e.razon).toMatch(/No hay estudios detallados/);
  });

  it("evaluado y sin peligros: nunca dice 'seguro' ni 'apto'", () => {
    const e = evaluarConstruccion(lugar([], { conEstudios: true }, ["aluvion"]));
    expect(e.estado).toBe("sin_peligros");
    expect(`${e.titulo} ${e.razon}`).not.toMatch(/segur|apto/i);
    expect(e.acciones).toContain("Tramita la licencia de construcción en la Municipalidad.");
  });

  it("nunca 'sin peligros' si cerca ya ocurrió algo (p. ej. el huaico de 2025 a 330 m)", () => {
    const e = evaluarConstruccion(lugar([], { conEstudios: true, eventoCercano: { texto: "huaico por el río Paria (2025-04-28)", distanciaM: 330 } }, ["aluvion"]));
    expect(e.estado).toBe("estudio");
    expect(e.razon).toBe("A 330 m ya ocurrió: huaico por el río Paria (2025-04-28)");
  });

  it("a 50 m o menos de un río: no construir por la faja marginal (Ley 29338)", () => {
    const e = evaluarConstruccion(lugar([], { cauce: { distanciaM: 20, nombre: "Río Quilcay" } }));
    expect(e.estado).toBe("no_construir");
    expect(e.razon).toMatch(/^Estás a 20 m del cauce del Río Quilcay/);
    expect(e.razon).toMatch(/Ley 29338/);
  });

  it("lo revisado incluye tierra, pendiente, río y cada peligro", () => {
    const e = evaluarConstruccion(lugar([], { pendiente: 1, cauce: { distanciaM: 120, nombre: "Río Quilcay" } }));
    expect(e.revisado.map((r) => r.tema)).toEqual(["Tierra", "Pendiente del terreno", "Río o quebrada", "Aluvión", "Huaico", "Inundación", "Caída de rocas", "Erosión"]);
    expect(e.revisado[2].texto).toBe("Río Quilcay a 120 m");
    expect(e.estado).toBe("estudio");
  });
});
