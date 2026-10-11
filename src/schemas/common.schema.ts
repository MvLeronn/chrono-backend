import { z } from 'zod';
import { daysBetween, parseDate, validDateString } from '../domain/dates.js';

export const dateSchema = z.string().refine(validDateString, 'Data inválida. Use YYYY-MM-DD.');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.');
export const typeSchema = z.enum(['EVENT', 'TASK']);
export const statusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED']);
export const idParams = z.strictObject({ id: z.uuid() });
export const empty = z.strictObject({});
export const activityFields = {
    type: typeSchema.optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).nullable().optional(),
    startTime: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
};
export const rangeSchema = z
    .strictObject({ from: dateSchema, to: dateSchema })
    .superRefine((value, ctx) => {
        if (!validDateString(value.from) || !validDateString(value.to)) return;
        const days = daysBetween(parseDate(value.from), parseDate(value.to));
        if (days < 0 || days > 365)
            ctx.addIssue({
                code: 'custom',
                message: 'O intervalo deve conter de 1 a 366 dias.',
                path: ['to'],
            });
    });

export function request<B extends z.ZodType>(
    body: B,
): z.ZodObject<{ body: B; params: typeof empty; query: typeof empty }>;
export function request<B extends z.ZodType, P extends z.ZodType>(
    body: B,
    params: P,
): z.ZodObject<{ body: B; params: P; query: typeof empty }>;
export function request<B extends z.ZodType, P extends z.ZodType, Q extends z.ZodType>(
    body: B,
    params: P,
    query: Q,
): z.ZodObject<{ body: B; params: P; query: Q }>;
export function request(body: z.ZodType, params: z.ZodType = empty, query: z.ZodType = empty) {
    return z.object({ body, params, query });
}

export const calendarSchema = request(empty, empty, rangeSchema);
export const idSchema = request(empty, idParams);
export const listSchema = request(
    empty,
    empty,
    z.strictObject({
        page: z.coerce.number().int().min(1).max(100_000).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
);
export const passwordSchema = z
    .string()
    .min(12)
    .refine(
        (value) => Buffer.byteLength(value, 'utf8') <= 72,
        'A senha deve ter no máximo 72 bytes.',
    );
