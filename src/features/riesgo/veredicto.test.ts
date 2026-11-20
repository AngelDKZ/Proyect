import { describe, expect, it } from "vitest";
import { construirVeredicto, type Hallazgo } from "./veredicto";

const h = (o: Partial<Hallazgo>): Hallazgo => ({
  peligro: "aluvion",
  categoria: "zona_modelada",
  nivel: null,
  dentro: true,
  distanciaM: 0,
  confianza: "alta",
  texto: "texto",
  fuente: "fuente",
  ...o,
});

describe("construirVeredicto", () => {
  it("aluvión: toma el nivel más alto de la zona modelada y propone la zona segura", () => {
    const v = construirVeredicto(
      "aluvion",
      [h({ nivel: 2 }), h({ nivel: 4, texto: "Cono del Quillcay" })],
      { dentroDeCobertura: true, zonaSegura: { nombre: "Plaza de Armas", tipo: "zona_seguridad", distanciaM: 452, coordenadas: [0, 0] } },
    );
    expect(v.nivel).toBe(4);
    expect(v.titulo).toBe("Aluvión: peligro muy alto");
    expect(v.acciones.join(" ")).toContain("Plaza de Armas (450 m");
  });

  it("aluvión: dentro del mapa oficial pero fuera de zonas = evaluado, nunca 'seguro'", () => {
    const v = construirVeredicto("aluvion", [], { dentroDeCobertura: true });
    expect(v.nivel).toBe(-1);
    expect(v.titulo).not.toMatch(/segur/i);
    expect(v.titulo).toBe("Aluvión: evaluado, sin peligro identificado");
  });

  it("sin datos: 'sin información' y aviso de que no significa seguro", () => {
    const v = construirVeredicto("inundacion_pluvial", []);
    expect(v.nivel).toBe(0);
    expect(v.titulo).toBe("Inundación: sin información para este lugar");
    expect(v.resumen).toMatch(/no significa que sea seguro/);
  });

  it("inundación: un evento preciso pesa más que un sector aproximado", () => {
    const v = construirVeredicto("inundacion_pluvial", [
      h({ peligro: "inundacion_pluvial", categoria: "sector_expuesto", confianza: "media", texto: "Sector Pedregal" }),
      h({ peligro: "inundacion_pluvial", categoria: "evento_registrado", confianza: "alta", texto: "Se inundó el 06-11-2026" }),
    ]);
    expect(v.nivel).toBe(3);
    expect(v.resumen).toBe("Se inundó el 06-11-2026");
  });

  it("deslizamiento: susceptibilidad baja cuenta como evaluada (-1); muy alta como 3", () => {
    expect(construirVeredicto("deslizamiento", [h({ peligro: "deslizamiento", categoria: "susceptibilidad", nivel: 2 })]).nivel).toBe(-1);
    expect(construirVeredicto("deslizamiento", [h({ peligro: "deslizamiento", categoria: "susceptibilidad", nivel: 5 })]).nivel).toBe(3);
  });

  it("el detalle excluye lo lejano e ignora otros peligros", () => {
    const v = construirVeredicto("huaico", [
      h({ peligro: "huaico", categoria: "evento_registrado", dentro: false, distanciaM: 120, texto: "cerca" }),
      h({ peligro: "huaico", categoria: "evento_registrado", dentro: false, distanciaM: 900, texto: "lejos" }),
      h({ peligro: "deslizamiento", categoria: "area_evaluada", texto: "otro peligro" }),
    ]);
    // El huaico cercano se informa en el detalle, pero no sube el nivel: el huaico baja por su cauce, no en círculo.
    expect(v.detalle.map((d) => d.texto)).toEqual(["cerca"]);
    expect(v.nivel).toBe(0);
  });
});

describe("registros cercanos", () => {
  it("un aniego a 60 m da 'registrado a 60 m' (nivel 1), no 'sin información'", () => {
    const v = construirVeredicto("inundacion_pluvial", [
      { peligro: "inundacion_pluvial", categoria: "aniego_recurrente", nivel: null, dentro: false, distanciaM: 58, confianza: "alta", texto: "Av. Luzuriaga: aniegos recurrentes", fuente: "Contraloría" },
    ]);
    expect(v.nivel).toBe(1);
    expect(v.titulo).toBe("Inundación: registrado a 60 m");
    expect(v.resumen).toBe("A 60 m: Av. Luzuriaga: aniegos recurrentes");
  });

  it("el aluvión no usa 'cerca': fuera de zona sigue siendo 'evaluado'", () => {
    const v = construirVeredicto(
      "aluvion",
      [{ peligro: "aluvion", categoria: "zona_modelada", nivel: 4, dentro: false, distanciaM: 40, confianza: "alta", texto: "zona", fuente: "f" }],
      { dentroDeCobertura: true },
    );
    expect(v.nivel).toBe(-1);
  });
});

describe("acciones", () => {
  it("sin información o evaluado: no hay acciones (no repetir el aviso de construir en todo)", () => {
    expect(construirVeredicto("huaico", []).acciones).toEqual([]);
    expect(construirVeredicto("aluvion", [], { dentroDeCobertura: true }).acciones).toEqual([]);
  });

  it("el motivo para no construir solo aparece con peligro alto o muy alto, y explica por qué", () => {
    const medio = construirVeredicto("deslizamiento", [h({ peligro: "deslizamiento", categoria: "evento_registrado" })]);
    expect(medio.nivel).toBe(2);
    expect(medio.noConstruir).toBeNull();
    const medido = construirVeredicto("deslizamiento", [h({ peligro: "deslizamiento", categoria: "area_evaluada" })]);
    expect(medido.noConstruir).toMatch(/ya se deslizó/);
    const debil = construirVeredicto("deslizamiento", [h({ peligro: "deslizamiento", categoria: "susceptibilidad", nivel: 5 })]);
    expect(debil.noConstruir).toMatch(/tierra débil/);
  });

  it("en la ciudad (aluvión, recorrido de huaico, inundación) solo informa el peligro, sin 'no construyas'", () => {
    const aluvion = construirVeredicto("aluvion", [h({ nivel: 4 })], { dentroDeCobertura: true });
    expect(aluvion.nivel).toBe(4);
    expect(aluvion.noConstruir).toBeNull();
    expect(construirVeredicto("huaico", [h({ peligro: "huaico", categoria: "sector_expuesto", confianza: "media" })]).noConstruir).toBeNull();
    const inund = construirVeredicto("inundacion_pluvial", [h({ peligro: "inundacion_pluvial", categoria: "aniego_recurrente" })]);
    expect(inund.nivel).toBe(3);
    expect(inund.noConstruir).toBeNull();
  });
});

describe("un río por sí solo no es nivel de peligro de huaico", () => {
  it("a 30 m de un cauce sin huaicos documentados: sin información en huaico (la orilla se evalúa al construir)", () => {
    const v = construirVeredicto("huaico", [h({ peligro: "huaico", categoria: "cauce", dentro: false, distanciaM: 28, nombre: "Río Quilcay" })]);
    expect(v.nivel).toBe(0);
    expect(v.noConstruir).toBeNull();
    expect(v.detalle).toEqual([]);
  });
});

describe("lugares seguros por peligro", () => {
  const zona = { nombre: "Parque Bicentenario", tipo: "refugio_temporal", distanciaM: 338, coordenadas: [0, 0] as [number, number] };

  it("huaico: propone el lugar seguro más cercano fuera de zonas de huaico", () => {
    const v = construirVeredicto("huaico", [h({ peligro: "huaico", categoria: "evento_registrado" })], { zonaSegura: zona });
    expect(v.acciones.join(" ")).toContain("fuera de zonas de huaico: Parque Bicentenario (340 m");
  });

  it("inundación: propone el refugio temporal solo si el lugar se inunda (nivel 2 o más)", () => {
    const alto = construirVeredicto("inundacion_pluvial", [h({ peligro: "inundacion_pluvial", categoria: "aniego_recurrente" })], { zonaSegura: zona });
    expect(alto.acciones.join(" ")).toContain("refugio temporal más cercano: Parque Bicentenario");
    const cerca = construirVeredicto(
      "inundacion_pluvial",
      [h({ peligro: "inundacion_pluvial", categoria: "aniego_recurrente", dentro: false, distanciaM: 60 })],
      { zonaSegura: zona },
    );
    expect(cerca.nivel).toBe(1);
    expect(cerca.acciones.join(" ")).not.toContain("refugio");
  });
});

describe("huaico: solo hechos, sin predicción", () => {
  it("donde ya bajó un huaico: nivel 4 y 'no construyas' con la fecha", () => {
    const v = construirVeredicto("huaico", [h({ peligro: "huaico", categoria: "evento_registrado", fecha: "2025-04-28" })]);
    expect(v.nivel).toBe(4);
    expect(v.titulo).toBe("Huaico: ya bajó un huaico aquí");
    expect(v.noConstruir).toMatch(/ya bajó un huaico \(2025-04-28\)/);
  });

  it("ya no copia el modelo del aluvión: una zona de aluvión no cuenta como huaico", () => {
    const v = construirVeredicto("huaico", [h({ peligro: "aluvion", categoria: "zona_modelada", nivel: 4 })]);
    expect(v.nivel).toBe(0);
  });
});

describe("huaico: zona crítica oficial separada de la cercanía al río", () => {
  it("zona crítica del INGEMMET = nivel 2, por encima del río (1)", () => {
    const v = construirVeredicto("huaico", [
      h({ peligro: "huaico", categoria: "zona_critica", texto: "Quebrada Río Seco" }),
    ]);
    expect(v.nivel).toBe(2);
    expect(v.titulo).toBe("Huaico: zona crítica del INGEMMET o camino aguas abajo de un huaico documentado");
  });
});

describe("la tarjeta nunca dice menos que el color de la manzana", () => {
  it("si la manzana está en azul oscuro por un camino aguas abajo, el punto también", () => {
    const v = construirVeredicto("huaico", [], { manzana: { nivel: 2, detalle: ["Camino aguas abajo de un huaico documentado"] } });
    expect(v.nivel).toBe(2);
    expect(v.titulo).toBe("Huaico: zona crítica del INGEMMET o camino aguas abajo de un huaico documentado en parte de tu manzana");
    expect(v.resumen).toBe("Parte de tu manzana: Camino aguas abajo de un huaico documentado.");
    expect(v.noConstruir).toBeNull();
  });

  it("el 'no construyas' solo se decide con el punto exacto", () => {
    const v = construirVeredicto("deslizamiento", [], { manzana: { nivel: 3, detalle: ["Susceptibilidad muy alta"] } });
    expect(v.nivel).toBe(3);
    expect(v.noConstruir).toBeNull();
  });
});

describe("huaico: cada zona propensa está conectada por un camino", () => {
  it("dentro del camino aguas abajo de un huaico documentado: azul fuerte (2)", () => {
    const v = construirVeredicto("huaico", [h({ peligro: "huaico", categoria: "camino_aguas_abajo", texto: "Camino aguas abajo de Ichoca" })]);
    expect(v.nivel).toBe(2);
    expect(v.resumen).toBe("Camino aguas abajo de Ichoca");
  });
});

describe("evaluado sin peligro en la manzana", () => {
  it("si la manzana es -1 y el punto cae en un hueco de la capa, la tarjeta también dice evaluado", () => {
    const v = construirVeredicto("deslizamiento", [], { manzana: { nivel: -1, detalle: [] } });
    expect(v.nivel).toBe(-1);
    expect(v.titulo).toBe("Deslizamiento: evaluado, terreno poco propenso a moverse");
  });
});

describe("aluvión ya ocurrido fuera del mapa oficial", () => {
  it("recorrido del aluvión de 2025: 'ya bajó un aluvión aquí' con la fecha", () => {
    const v = construirVeredicto("aluvion", [h({ categoria: "evento_registrado", nivel: 4, fecha: "2025-04-28", texto: "Recorrido del flujo de Llaca–Casca" })]);
    expect(v.nivel).toBe(4);
    expect(v.titulo).toBe("Aluvión: ya bajó un aluvión aquí (2025-04-28)");
  });
});
