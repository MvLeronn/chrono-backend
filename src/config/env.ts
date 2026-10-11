import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default('127.0.0.1'),
    DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:/.test(value)),
    JWT_SECRET: z
        .string()
        .min(32)
        .refine((value) => !value.startsWith('replace-'), 'Configure um segredo JWT próprio.'),
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().min(60).max(2_592_000).default(86_400),
    TIMEZONE: z
        .string()
        .default('America/Sao_Paulo')
        .refine((value) => {
            try {
                new Intl.DateTimeFormat('en-US', { timeZone: value });
                return true;
            } catch {
                return false;
            }
        }),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

const result = schema.safeParse(process.env);
if (!result.success) {
    // Report field names/messages, never configuration values or secrets.
    throw new Error(
        `Configuração inválida: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
}
export const env = result.data;
