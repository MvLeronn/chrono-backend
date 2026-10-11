import prisma from '../../prisma/index.js';
import { serializeEvent } from '../../domain/activity.js';
import { parseDate } from '../../domain/dates.js';

export class ListEventsService {
    async execute(userId: string, from: string, to: string) {
        const events = await prisma.event.findMany({
            where: { userId, date: { gte: parseDate(from), lte: parseDate(to) } },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
        });
        return events.map(serializeEvent);
    }
}
