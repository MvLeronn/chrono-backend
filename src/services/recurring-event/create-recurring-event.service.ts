import prisma from '../../prisma/index.js';
import { serializeRule } from '../../domain/activity.js';
import { parseDate, parseTime } from '../../domain/dates.js';
import type { RecurringInput } from '../../schemas/recurring.schema.js';
import { assertRule } from './shared/assert-rule.js';

export class CreateRecurringEventService {
    async execute(userId: string, input: RecurringInput) {
        const data = {
            userId,
            type: input.type,
            title: input.title,
            description: input.description,
            startDate: parseDate(input.startDate),
            effectiveFrom: parseDate(input.startDate),
            startTime: parseTime(input.startTime),
            endTime: parseTime(input.endTime),
            frequency: input.frequency,
            interval: input.interval ?? 1,
            until: input.until ? parseDate(input.until) : null,
            count: input.count ?? null,
        };
        assertRule(data);
        return serializeRule(await prisma.recurringEvent.create({ data }));
    }
}
