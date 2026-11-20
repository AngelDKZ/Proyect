import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Node 22 lee archivos .env sin dependencias extra.
if (existsSync(".env")) process.loadEnvFile(".env");

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL: copia .env.example a .env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  // Tablas propias de PostGIS que drizzle-kit no debe intentar gestionar
  tablesFilter: ["!spatial_ref_sys", "!geography_columns", "!geometry_columns"],
  strict: true,
  verbose: true,
});
