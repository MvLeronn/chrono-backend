import { serializeRule } from '../../domain/activity.js';
import { addDays, dateString, parseDate } from '../../domain/dates.js';
import { AppError } from '../../domain/errors.js';
import { transaction } from '../shared/transaction.js';
import { ownedRule } from './shared/get-owned-rule.js';
import { assertFutureBoundary } from './shared/assert-future-boundary.js';

export class EndRecurringEventService {
    async execute(userId: string, id: string, dateValue: string) {
        return transaction(async (tx) => {
            const current = await ownedRule(tx, userId, id);
            const boundary = parseDate(dateValue);
            await assertFutureBoundary(tx, userId, boundary);
            if (boundary < current.effectiveFrom)
                throw new AppError(
                    400,
                    'INVALID_END_DATE',
                    'O encerramento não pode anteceder o segmento.',
                );
            if (await tx.recurringEvent.findUnique({ where: { previousId: id } }))
                throw new AppError(
                    409,
                    'SERIES_ALREADY_SPLIT',
                    'Encerre o último segmento da série.',
                );
            if (current.effectiveUntil && boundary > current.effectiveUntil)
                return serializeRule(current);
            const saved = await tx.recurringOccurrence.findMany({
                where: { recurringEventId: id, deleted: false, occurrenceDate: { gte: boundary } },
            });
            if (saved.length)
                throw new AppError(
                    409,
                    'OCCURRENCE_CONFLICT',
                    'Existem ocorrências personalizadas após o encerramento. Escolha outro limite ou redefina essas ocorrências explicitamente.',
                    {
                        occurrences: saved.map((item) => ({
                            occurrenceDate: dateString(item.occurrenceDate),
                            status: item.status,
                        })),
                    },
                );
            return serializeRule(
                await tx.recurringEvent.update({
                    where: { id },
                    data: { effectiveUntil: addDays(boundary, -1) },
                }),
            );
        });
    }
}
