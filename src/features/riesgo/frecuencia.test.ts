import { describe, expect, it } from "vitest";
import { frecuencia } from "./frecuencia";

describe("¿Cada cuánto pasa?", () => {
  it("inundación: 6 de los últimos 9 años", () => {
    expect(frecuencia("inundacion_pluvial", [2018, 2019, 2021, 2023, 2025, 2026, 2026], 2026).texto).toBe("Casi todos los años: 6 de los últimos 9.");
  });
  it("deslizamiento: todos los años desde 2022", () => {
    expect(frecuencia("deslizamiento", [2022, 2023, 2024, 2025, 2026], 2026).texto).toBe("Todos los años desde 2022.");
  });
  it("huaico: 3 de los últimos 4; nunca porcentajes", () => {
    const f = frecuencia("huaico", [2023, 2025, 2026], 2026);
    expect(f.texto).toBe("Casi todos los años: 3 de los últimos 4.");
    expect(f.texto).not.toMatch(/%/);
  });
  it("aluvión: texto fijo con 1941 y 2025", () => {
    expect(frecuencia("aluvion", [], 2026).texto).toMatch(/1941.*2025/);
  });
});
