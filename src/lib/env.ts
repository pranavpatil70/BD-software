import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  TURSO_DATABASE_URL: z.string().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_DEFAULT_COUNTRY_CODE: z.string().default('+91'),
  SESSION_COOKIE_NAME: z.string().default('bd_session'),
  SESSION_MAX_AGE_DAYS: z.coerce.number().default(30),
}).refine(
  (env) => !env.TURSO_DATABASE_URL || !!env.TURSO_AUTH_TOKEN,
  { message: 'TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set' }
)

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data
