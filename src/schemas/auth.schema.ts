import { z } from 'zod';
import { request } from './common.schema.js';

export const loginSchema = request(
    z.strictObject({
        password: z
            .string()
            .min(1)
            .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Senha muito longa.'),
    }),
);
