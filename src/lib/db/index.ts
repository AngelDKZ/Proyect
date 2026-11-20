/**
 * Cliente de base de datos (solo servidor).
 * Se reutiliza una única conexión en desarrollo para que la recarga en caliente
 * de Next.js no abra conexiones nuevas en cada cambio.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

function createClient() {
  const url = serverEnv().DATABASE_URL;
  // En Vercel cada función es un proceso corto: una conexión por instancia. Con la conexión "agrupada" de Neon
  // (host con "-pooler", PgBouncer en modo transacción) no se pueden usar sentencias preparadas.
  const enVercel = Boolean(process.env.VERCEL);
  const agrupada = /-pooler\./.test(url);
  return postgres(url, {
    max: enVercel ? 1 : 5,
    prepare: !agrupada,
    // Neon y otros servicios gestionados cierran conexiones inactivas: se reconecta solo.
    idle_timeout: 20,
  });
}

const client = globalForDb.pgClient ?? createClient();
if (serverEnv().NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
