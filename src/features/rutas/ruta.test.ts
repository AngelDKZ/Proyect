import { describe, expect, it } from "vitest";
import { Grafo, pasos, type Tramo } from "./ruta";

// Cuadrícula pequeña: ~111 m por 0.001°. El origen está en (0,0); hay dos destinos posibles.
const t = (ax: number, ay: number, bx: number, by: number, peligroso = false, calle: string | null = "Jr. A"): Tramo => ({
  ax, ay, bx, by, largo: Math.hypot(bx - ax, by - ay) * 111_320, peligroso, calle,
});

describe("rutas a pie", () => {
  it("llega al destino más cercano por calles", () => {
    const g = new Grafo([t(0, 0, 0.001, 0), t(0.001, 0, 0.002, 0), t(0, 0, -0.001, 0), t(-0.001, 0, -0.003, 0)]);
    const r = g.ruta(0, 0, [{ lon: 0.002, lat: 0, dato: "este" }, { lon: -0.003, lat: 0, dato: "oeste" }]);
    expect(r?.destino).toBe("este");
    expect(r?.metros).toBe(223);
    expect(r?.minutos).toBe(4);
  });

  it("evita la zona de peligro aunque el camino sea más largo, y dice cuánto falta para salir", () => {
    // Al este: 220 m, pero todo dentro de la zona de peligro. Al oeste: 330 m, fuera de la zona.
    const g = new Grafo([t(0, 0, 0.002, 0, true), t(0, 0, -0.003, 0, false)]);
    const r = g.ruta(0, 0, [{ lon: 0.002, lat: 0, dato: "este" }, { lon: -0.003, lat: 0, dato: "oeste" }]);
    expect(r?.destino).toBe("oeste");
    expect(r?.metrosHastaSalir).toBe(0);
    const sinPeligro = g.ruta(0, 0, [{ lon: 0.002, lat: 0, dato: "este" }, { lon: -0.003, lat: 0, dato: "oeste" }], false);
    expect(sinPeligro?.destino).toBe("este");
  });

  it("cuenta los metros hasta salir de la zona", () => {
    const g = new Grafo([t(0, 0, 0.001, 0, true), t(0.001, 0, 0.003, 0, false)]);
    const r = g.ruta(0, 0, [{ lon: 0.003, lat: 0, dato: "seguro" }]);
    expect(r?.metrosHastaSalir).toBe(111);
  });

  it("sin calles cerca (más de 300 m) no inventa una ruta", () => {
    const g = new Grafo([t(0, 0, 0.001, 0)]);
    expect(g.ruta(0.01, 0.01, [{ lon: 0.001, lat: 0, dato: "x" }])).toBeNull();
  });

  it("indicaciones: agrupa por calle y dice el giro", () => {
    const p = pasos([
      { calle: "Jr. Sucre", largo: 120, x1: 0, y1: 0, x2: 0, y2: 0.001 }, // hacia el norte
      { calle: "Av. Luzuriaga", largo: 200, x1: 0, y1: 0.001, x2: 0.002, y2: 0.001 }, // gira al este = derecha
    ]);
    expect(p.map((x) => x.texto)).toEqual(["Camina por Jr. Sucre 100 m.", "Gira a la derecha en Av. Luzuriaga y avanza 200 m."]);
  });
});
