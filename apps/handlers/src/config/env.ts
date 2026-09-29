import { z } from "zod";

const env_schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  HANDLERS_PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_ORIGIN: z.url(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1),
  DB_HANDLERS_USERNAME: z.string().min(1),
  DB_HANDLERS_PASSWORD: z.string().min(1),
  CORE_API_URL: z.url(),
  SERVICE_HMAC_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof env_schema>;

/**
 * Validates the process environment once, at startup.
 *
 * @param source - The raw environment, normally `process.env`.
 * @returns The typed settings. No other module reads `process.env`.
 * @throws {Error} Naming every missing or invalid variable, without its value.
 */
export function load_env(source: Record<string, string | undefined>): Env {
  const parsed = env_schema.safeParse(source);
  if (parsed.success) return parsed.data;

  const problems = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment. ${problems}`);
}
