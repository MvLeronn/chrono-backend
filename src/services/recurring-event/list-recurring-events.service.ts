import prisma from '../../prisma/index.js';
import { serializeRule } from '../../domain/activity.js';

export class ListRecurringEventsService {
    async execute(userId: string, page: number, limit: number) {
        const [items, total] = await prisma.$transaction([
            prisma.recurringEvent.findMany({
                where: { userId },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
            }),
            prisma.recurringEvent.count({ where: { userId } }),
        ]);
        return { items: items.map(serializeRule), total, page, limit };
    }
}
