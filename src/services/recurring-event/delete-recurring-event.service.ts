import prisma from '../../prisma/index.js';
import { today } from '../../domain/dates.js';
import { AppError, notFound } from '../../domain/errors.js';
import { isActiveRecurrence } from '../../domain/recurrence.js';
import { lock } from '../shared/lock.js';
import { transaction } from '../shared/transaction.js';
import { ownedRule } from './shared/get-owned-rule.js';

export class DeleteRecurringEventService {
    async execute(userId: string, id: string) {
        const reference = await prisma.recurringEvent.findFirst({ where: { id, userId } });
        if (!reference) notFound();
        return transaction(async (tx) => {
            // Serialize removals of adjacent segments before reading their links.
            await lock(tx, `recurring-series:${reference.seriesId}`);
            const current = await ownedRule(tx, userId, id);
            const next = await tx.recurringEvent.findUnique({ where: { previousId: id } });
            const user = await tx.user.findUniqueOrThrow({
                where: { id: userId },
                select: { timezone: true },
            });
            if (isActiveRecurrence(current, next !== null, today(user.timezone))) {
                throw new AppError(
                    409,
                    'RECURRENCE_ACTIVE',
                    'Encerre as próximas repetições antes de excluir a recorrência.',
                );
            }
            if (current.previousId) await lock(tx, `recurring:${current.previousId}`);
            if (next) {
                await lock(tx, `recurring:${next.id}`);
                // Release the unique previousId before reconnecting the surviving segments.
                await tx.recurringEvent.update({
                    where: { id: next.id },
                    data: { previousId: null },
                });
            }
            await tx.recurringOccurrence.deleteMany({ where: { recurringEventId: id } });
            await tx.recurringEvent.delete({ where: { id } });
            if (next && current.previousId) {
                await tx.recurringEvent.update({
                    where: { id: next.id },
                    data: { previousId: current.previousId },
                });
            }
        });
    }
}
