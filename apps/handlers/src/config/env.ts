import { z } from "zod";

// One or more origins separated by commas. Production has one. Development
// has two: the browser's, and the one the end-to-end container uses.
const origins_schema = z
  .string()
  .min(1)
  .transform((value) => value.split(",").map((origin) => origin.trim()))
  .pipe(z.array(z.url()).min(1));

const env_schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  HANDLERS_PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_ORIGINS: origins_schema,
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
 * @throws {Error} Naming every missing or invalid variable, without its
 *   value. Also when the session secret and the service secret are the
 *   same, since one leak would then break both.
 */
export function load_env(source: Record<string, string | undefined>): Env {
  const parsed = env_schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment. ${problems}`);
  }
  if (parsed.data.SESSION_SECRET === parsed.data.SERVICE_HMAC_SECRET) {
    throw new Error(
      "Invalid environment. SESSION_SECRET and SERVICE_HMAC_SECRET must differ.",
    );
  }
  return parsed.data;
}
