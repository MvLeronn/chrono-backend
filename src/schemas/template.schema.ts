import { z } from 'zod';
import { activityFields, dateSchema, idParams, request } from './common.schema.js';

export const templateItem = z.strictObject({
    ...activityFields,
    weekday: z.number().int().min(1).max(7),
});
export const templateBody = z.strictObject({
    name: z.string().trim().min(1).max(100),
    items: z.array(templateItem).max(200),
});
export const createTemplateSchema = request(templateBody);
export const updateTemplateSchema = request(
    templateBody
        .partial()
        .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.'),
    idParams,
);
export const applyTemplateSchema = request(z.strictObject({ weekStart: dateSchema }), idParams);
export type TemplateInput = z.infer<typeof templateBody>;
