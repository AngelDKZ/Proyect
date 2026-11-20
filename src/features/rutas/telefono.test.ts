import { describe, expect, it } from "vitest";
import { telefonosLegibles, telHref } from "./telefono";

describe("teléfonos del registro", () => {
  it("normaliza fijos de Áncash y celulares", () => {
    expect(telefonosLegibles("043-421290")).toEqual(["(043) 421290"]);
    expect(telefonosLegibles("43422773")).toEqual(["(043) 422773"]);
    expect(telefonosLegibles("043 - 221784")).toEqual(["(043) 221784"]);
    expect(telefonosLegibles("947673657")).toEqual(["947 673 657"]);
  });
  it("separa varios números y descarta lo que no es un teléfono", () => {
    expect(telefonosLegibles("043-421290 / 943786837")).toEqual(["(043) 421290", "943 786 837"]);
    expect(telefonosLegibles("123")).toEqual([]);
    expect(telefonosLegibles(null)).toEqual([]);
  });
  it("el enlace para llamar lleva solo dígitos", () => {
    expect(telHref("(043) 421290")).toBe("tel:043421290");
  });
});
