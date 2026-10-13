import prisma from '../../prisma/index.js';
import { serializeRule } from '../../domain/activity.js';
import { today } from '../../domain/dates.js';
import { isActiveRecurrence } from '../../domain/recurrence.js';
import type { RecurringListStatus } from '../../schemas/recurring.schema.js';

export class ListRecurringEventsService {
    async execute(
        userId: string,
        page: number,
        limit: number,
        status: RecurringListStatus = 'active',
    ) {
        return prisma.$transaction(async (tx) => {
            if (status === 'all') {
                const where = { userId };
                const [items, total] = await Promise.all([
                    tx.recurringEvent.findMany({
                        where,
                        skip: (page - 1) * limit,
                        take: limit,
                        orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
                    }),
                    tx.recurringEvent.count({ where }),
                ]);
                return { items: items.map(serializeRule), total, page, limit };
            }
            const [rules, user] = await Promise.all([
                tx.recurringEvent.findMany({
                    where: { userId },
                    include: { next: { select: { id: true } } },
                    orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }],
                }),
                tx.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
            ]);
            // Today stays in the calendar; this list manages repetitions after today.
            const boundary = today(user.timezone);
            // Recurrence limits (including count) must be evaluated before pagination.
            const matching = rules.filter((rule) => {
                const active = isActiveRecurrence(rule, rule.next !== null, boundary);
                return status === 'active' ? active : !active;
            });
            const items = matching.slice((page - 1) * limit, page * limit);
            return { items: items.map(serializeRule), total: matching.length, page, limit };
        });
    }
}
