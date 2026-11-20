import { describe, expect, it } from "vitest";
import { ewkbToGeoJSON } from "./geometry";

// Valores generados por PostGIS 3.5 (ST_GeomFromText(..., 4326)) en la base de desarrollo.
const FIXTURES = {
  point: "0101000020E6100000FD87F4DBD76153C08FC2F5285C0F23C0",
  linestring: "0102000020E61000000200000052B81E85EB6153C08FC2F5285C0F23C0E17A14AE476153C014AE47E17A1423C0",
  polygonWithHole:
    "0103000020E6100000020000000500000066666666666653C033333333333323C09A999999995953C033333333333323C09A999999995953C0CDCCCCCCCCCC22C066666666666653C0CDCCCCCCCCCC22C066666666666653C033333333333323C00400000033333333336353C09A999999991923C0CDCCCCCCCC5C53C09A999999991923C0CDCCCCCCCC5C53C06666666666E622C033333333336353C09A999999991923C0",
  multipolygon:
    "0106000020E6100000020000000103000000010000000400000066666666666653C033333333333323C000000000006053C033333333333323C000000000006053C000000000000023C066666666666653C033333333333323C0010300000001000000040000009A999999995953C0CDCCCCCCCCCC22C033333333335353C0CDCCCCCCCCCC22C033333333335353C09A999999999922C09A999999995953C0CDCCCCCCCCCC22C0",
  multilinestring:
    "0105000020E61000000200000001020000000200000000000000006053C000000000000023C09A999999995953C0CDCCCCCCCCCC22C001020000000200000033333333335353C09A999999999922C0CDCCCCCCCC4C53C066666666666622C0",
  multipoint:
    "0104000020E610000002000000010100000000000000006053C000000000000023C001010000009A999999995953C0CDCCCCCCCCCC22C0",
};

describe("ewkbToGeoJSON", () => {
  it("lee un punto (Plaza de Armas de Huaraz)", () => {
    expect(ewkbToGeoJSON(FIXTURES.point)).toEqual({ type: "Point", coordinates: [-77.5288, -9.53] });
  });

  it("lee una línea", () => {
    expect(ewkbToGeoJSON(FIXTURES.linestring)).toEqual({
      type: "LineString",
      coordinates: [
        [-77.53, -9.53],
        [-77.52, -9.54],
      ],
    });
  });

  it("lee un polígono con hueco", () => {
    const g = ewkbToGeoJSON(FIXTURES.polygonWithHole);
    expect(g.type).toBe("Polygon");
    if (g.type !== "Polygon") return;
    expect(g.coordinates).toHaveLength(2);
    expect(g.coordinates[0]).toHaveLength(5);
    expect(g.coordinates[1][0]).toEqual([-77.55, -9.55]);
  });

  it("lee multipolígonos, multilíneas y multipuntos", () => {
    const mp = ewkbToGeoJSON(FIXTURES.multipolygon);
    expect(mp.type).toBe("MultiPolygon");
    if (mp.type === "MultiPolygon") expect(mp.coordinates[1][0][0]).toEqual([-77.4, -9.4]);

    const ml = ewkbToGeoJSON(FIXTURES.multilinestring);
    expect(ml).toEqual({
      type: "MultiLineString",
      coordinates: [
        [
          [-77.5, -9.5],
          [-77.4, -9.4],
        ],
        [
          [-77.3, -9.3],
          [-77.2, -9.2],
        ],
      ],
    });

    expect(ewkbToGeoJSON(FIXTURES.multipoint)).toEqual({
      type: "MultiPoint",
      coordinates: [
        [-77.5, -9.5],
        [-77.4, -9.4],
      ],
    });
  });

  it("rechaza texto que no es EWKB", () => {
    expect(() => ewkbToGeoJSON("no-es-hex")).toThrow(/hexadecimal/);
  });
});
