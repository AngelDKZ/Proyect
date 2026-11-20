/**
 * Prueba de integración: escribe y lee geometrías en PostGIS a través de Drizzle.
 * Requiere la base local (npm run db:up && npm run db:migrate). Si no hay DATABASE_URL, se omite.
 * Todo se hace dentro de una transacción que se revierte: no deja datos en la base.
 */
import { afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { MultiPolygon, Point, Polygon } from "./geometry";

const url = process.env.DATABASE_URL;
const client = url ? postgres(url, { max: 1 }) : undefined;
const db = client ? drizzle(client, { schema }) : undefined;

class Rollback extends Error {}

describe.skipIf(!db)("geometrías en PostGIS (integración)", () => {
  afterAll(async () => {
    await client?.end();
  });

  it("guarda GeoJSON y lo devuelve igual, con SRID 4326 y consultas espaciales", async () => {
    // Un cuadrado de ~200 m alrededor de la Plaza de Armas de Huaraz
    const zona: Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [-77.5297, -9.5311],
          [-77.5279, -9.5311],
          [-77.5279, -9.5293],
          [-77.5297, -9.5293],
          [-77.5297, -9.5311],
        ],
      ],
    };
    const plaza: Point = { type: "Point", coordinates: [-77.5288, -9.5302] };
    const cobertura: MultiPolygon = { type: "MultiPolygon", coordinates: [zona.coordinates] };

    await expect(
      db!.transaction(async (tx) => {
        const [fuente] = await tx
          .insert(schema.dataSources)
          .values({ institution: "Prueba", name: "Fuente de prueba", type: "demo" })
          .returning();
        await tx.insert(schema.hazardTypes).values({ code: "prueba_tmp", name: "Prueba" });
        const [ds] = await tx
          .insert(schema.datasets)
          .values({ sourceId: fuente.id, title: "Dataset de prueba", hazardTypeCode: "prueba_tmp", coverage: cobertura, isDemo: true })
          .returning();
        const [f] = await tx
          .insert(schema.hazardFeatures)
          .values({ datasetId: ds.id, hazardTypeCode: "prueba_tmp", category: "zona_modelada", level: 4, geom: zona })
          .returning();

        // Lectura: vuelve como GeoJSON idéntico
        const [leido] = await tx.select().from(schema.hazardFeatures).where(eq(schema.hazardFeatures.id, f.id));
        expect(leido.geom).toEqual(zona);
        const [dsLeido] = await tx.select().from(schema.datasets).where(eq(schema.datasets.id, ds.id));
        expect(dsLeido.coverage).toEqual(cobertura);

        // SRID y consulta espacial en PostGIS
        const [r] = await tx.execute<{ srid: number; dentro: boolean; area_m2: number }>(sql`
          select ST_SRID(geom) as srid,
                 ST_Contains(geom, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(plaza)}), 4326)) as dentro,
                 ST_Area(geom::geography) as area_m2
          from hazard_features where id = ${f.id}`);
        expect(r.srid).toBe(4326);
        expect(r.dentro).toBe(true);
        expect(r.area_m2).toBeGreaterThan(30_000);
        expect(r.area_m2).toBeLessThan(50_000);

        throw new Rollback(); // revierte todo
      }),
    ).rejects.toBeInstanceOf(Rollback);

    // Confirmación de que no quedó nada
    const quedan = await db!.select().from(schema.hazardTypes).where(eq(schema.hazardTypes.code, "prueba_tmp"));
    expect(quedan).toHaveLength(0);
  });
});
