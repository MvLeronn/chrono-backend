import { z } from 'zod';
import {
    activityFields,
    dateSchema,
    idParams,
    request,
    statusSchema,
    timeSchema,
    typeSchema,
} from './common.schema.js';

export const recurringBody = z.strictObject({
    ...activityFields,
    startDate: dateSchema,
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    interval: z.number().int().min(1).max(10_000).optional(),
    until: dateSchema.nullable().optional(),
    count: z.number().int().min(1).max(1_000_000).nullable().optional(),
});
export const createRecurringSchema = request(recurringBody);
export const splitRecurringSchema = request(
    z.strictObject({
        fromDate: dateSchema,
        changes: recurringBody
            .partial()
            .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.'),
    }),
    idParams,
);
export const endRecurringSchema = request(z.strictObject({ fromDate: dateSchema }), idParams);
export const occurrenceParams = z.strictObject({ id: z.uuid(), occurrenceDate: dateSchema });
export const getOccurrenceSchema = request(z.strictObject({}), occurrenceParams);
export const occurrenceBody = z
    .strictObject({
        scheduledDate: dateSchema.optional(),
        status: statusSchema.optional(),
        typeOverride: typeSchema.nullable().optional(),
        titleOverride: z.string().trim().min(1).max(200).nullable().optional(),
        descriptionOverride: z.string().max(10_000).nullable().optional(),
        timeOverride: z
            .strictObject({
                startTime: timeSchema.nullable(),
                endTime: timeSchema.nullable(),
            })
            .nullable()
            .optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo.');
export const updateOccurrenceSchema = request(occurrenceBody, occurrenceParams);
export type RecurringInput = z.infer<typeof recurringBody>;
export type OccurrenceInput = z.infer<typeof occurrenceBody>;
