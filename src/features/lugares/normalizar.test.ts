import { describe, expect, it } from "vitest";
import { normalizar, palabrasDeBusqueda } from "./normalizar";

describe("normalizar", () => {
  it("quita tildes y mayúsculas, y expande abreviaturas", () => {
    expect(normalizar("Jr. Aija")).toBe("jiron aija");
    expect(normalizar("Urbanización Shancayán")).toBe("urbanizacion shancayan");
    expect(normalizar("Av. Mariscal Toribio de Luzuriaga")).toBe("avenida mariscal toribio de luzuriaga");
  });

  it("separa la búsqueda en palabras normalizadas", () => {
    expect(palabrasDeBusqueda("  shancayán  urb ")).toEqual(["shancayan", "urbanizacion"]);
    expect(palabrasDeBusqueda("")).toEqual([]);
  });
});
