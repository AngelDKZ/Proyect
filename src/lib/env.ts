/**
 * Variables de entorno validadas con Zod.
 * Si falta una variable obligatoria o tiene un formato inválido, la app falla al iniciar
 * con un mensaje claro, en lugar de fallar más tarde de forma confusa.
 */
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string({ error: "Falta DATABASE_URL (ver .env.example)" })
    .regex(/^postgres(ql)?:\/\//, "DATABASE_URL debe empezar con postgres:// o postgresql://"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url("NEXT_PUBLIC_SITE_URL debe ser una URL").default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

function format(error: z.ZodError) {
  return error.issues.map((i) => `  • ${i.path.join(".") || "(raíz)"}: ${i.message}`).join("\n");
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) throw new Error(`Variables de entorno inválidas:\n${format(result.error)}`);
  return result.data;
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicSchema.safeParse(source);
  if (!result.success) throw new Error(`Variables públicas inválidas:\n${format(result.error)}`);
  return result.data;
}

let cachedServerEnv: ServerEnv | undefined;

/** Solo en el servidor: nunca importar en componentes de cliente. */
export function serverEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}

// En Next.js las variables NEXT_PUBLIC_* deben leerse de forma literal para incluirse en el cliente.
export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
