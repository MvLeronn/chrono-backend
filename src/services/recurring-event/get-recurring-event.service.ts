import prisma from '../../prisma/index.js';
import { serializeRule } from '../../domain/activity.js';
import { notFound } from '../../domain/errors.js';
import { today } from '../../domain/dates.js';
import { isActiveRecurrence } from '../../domain/recurrence.js';

export class GetRecurringEventService {
    async execute(userId: string, id: string) {
        return prisma.$transaction(async (tx) => {
            const rule =
                (await tx.recurringEvent.findFirst({
                    where: { id, userId },
                    include: { next: { select: { id: true } } },
                })) ?? notFound();
            const user = await tx.user.findUniqueOrThrow({
                where: { id: userId },
                select: { timezone: true },
            });
            return {
                ...serializeRule(rule),
                isActive: isActiveRecurrence(rule, rule.next !== null, today(user.timezone)),
            };
        });
    }
}
