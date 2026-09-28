import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/, 'BOT_TOKEN должен иметь вид 123456:ABC...'),
  INIT_DATA_TTL: z.coerce.number().int().positive().default(86_400),
  CORS_ORIGIN: z.string().optional(),
  // Если оба заданы — API ставит webhook и отвечает на /start
  WEBAPP_URL: z.string().url().optional(),
  BOT_WEBHOOK_SECRET: z
    .string()
    .regex(/^[\w-]{1,256}$/, 'BOT_WEBHOOK_SECRET: 1–256 символов A-Z a-z 0-9 _ -')
    .optional(),
  PORT: z.coerce.number().int().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Некорректные переменные окружения:\n${msg}`);
  }
  return parsed.data;
}
