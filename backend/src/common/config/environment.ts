import { z } from 'zod';
import { LOG_LEVELS } from '../logging/app-logger';

// Compose passes an unset variable as an empty string; treat both as "not configured".
const optionalText = z.string().optional().transform((value) => value || undefined);

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  // pretty is for reading logs in a local terminal; containers keep JSON for log collectors.
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASS: z.string().min(1),
  DB_NAME: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('transcend'),
  JWT_AUDIENCE: z.string().min(1).default('transcend-web'),
  // 42 login is optional: without a client id and secret it answers "unavailable" instead of stopping the API.
  FORTYTWO_APP_ID: optionalText,
  FORTYTWO_APP_SECRET: optionalText,
  // Defaults to CORS_ORIGIN + /api/auth/42/callback; it must match a redirect URI registered on the 42 app.
  FORTYTWO_REDIRECT_URI: optionalText.pipe(z.url().optional()),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Never include environment values (especially credentials) in startup errors.
    throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  return result.data;
}
