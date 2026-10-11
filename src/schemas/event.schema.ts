import { z } from 'zod';
import { activityFields, dateSchema, idParams, request, statusSchema } from './common.schema.js';

export const eventBody = z.strictObject({
    ...activityFields,
    date: dateSchema,
    status: statusSchema.optional(),
});
export const createEventSchema = request(eventBody);
export const updateEventSchema = request(
    eventBody
        .partial()
        .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.'),
    idParams,
);
export type EventInput = z.infer<typeof eventBody>;
