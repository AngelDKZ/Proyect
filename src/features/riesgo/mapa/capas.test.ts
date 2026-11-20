import { describe, expect, it } from "vitest";
import { colorManzanas, leyenda, metrosAPixeles } from "./capas";
import { colorNivel, SIN_INFO_COLOR } from "../peligros";

describe("capas del mapa", () => {
  it("las manzanas usan los mismos colores que la escala del peligro", () => {
    const expr = colorManzanas("aluvion");
    const i = expr.indexOf(4);
    expect(expr[i + 1]).toBe(colorNivel("aluvion", 4));
    expect(expr.at(-1)).toBe(SIN_INFO_COLOR);
  });

  it("100 m a zoom 10 ≈ 0,66 px", () => {
    const expr = metrosAPixeles(100) as [string, unknown, unknown, number, unknown[], number, unknown[]];
    const z10 = expr[4] as [string, number, [string, number, number]];
    expect(100 / z10[2][2]).toBeCloseTo(0.663, 2);
  });

  it("la leyenda siempre termina en 'sin información' y nunca dice 'seguro' como estado", () => {
    for (const p of ["aluvion", "inundacion_pluvial", "deslizamiento"] as const) {
      const l = leyenda(p);
      expect(l.at(-1)?.nivel).toBe(0);
      expect(l.slice(0, -1).some((f) => /\bsegur/i.test(f.texto))).toBe(false);
    }
  });
});
