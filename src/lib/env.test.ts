import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("acepta una cadena de conexión de PostgreSQL", () => {
    const env = parseServerEnv({ DATABASE_URL: "postgres://mapa:clave@localhost:5433/mapa_riesgo" });
    expect(env.DATABASE_URL).toContain("mapa_riesgo");
    expect(env.NODE_ENV).toBe("development");
  });

  it("falla con un mensaje claro si falta DATABASE_URL", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rechaza URLs que no son de PostgreSQL", () => {
    expect(() => parseServerEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(/postgres:\/\//);
  });
});

describe("parsePublicEnv", () => {
  it("usa localhost por defecto", () => {
    expect(parsePublicEnv({}).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rechaza una URL inválida", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "no-es-url" })).toThrow(/URL/);
  });
});
