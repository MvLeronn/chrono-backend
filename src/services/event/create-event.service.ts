import prisma from '../../prisma/index.js';
import { assertTimeRange, completionTime, serializeEvent } from '../../domain/activity.js';
import { parseDate, parseTime } from '../../domain/dates.js';
import type { EventInput } from '../../schemas/event.schema.js';

export class CreateEventService {
    async execute(userId: string, input: EventInput) {
        const startTime = parseTime(input.startTime);
        const endTime = parseTime(input.endTime);
        assertTimeRange(startTime, endTime);
        const status = input.status ?? 'PENDING';
        return serializeEvent(
            await prisma.event.create({
                data: {
                    userId,
                    type: input.type,
                    title: input.title,
                    description: input.description,
                    date: parseDate(input.date),
                    startTime,
                    endTime,
                    status,
                    completedAt: completionTime(status, null),
                },
            }),
        );
    }
}
