import { AppError } from '../../domain/errors.js';
import { resolveOccurrence } from '../../domain/activity.js';
import { parseDate } from '../../domain/dates.js';
import { transaction } from '../shared/transaction.js';
import { ownedRule } from '../recurring-event/shared/get-owned-rule.js';
import { assertOccurrence } from '../recurring-event/shared/assert-occurrence.js';

export class ResetRecurringOccurrenceService {
    async execute(userId: string, id: string, dateValue: string) {
        return transaction(async (tx) => {
            const rule = await ownedRule(tx, userId, id);
            const date = parseDate(dateValue);
            assertOccurrence(rule, date);
            const existing = await tx.recurringOccurrence.findUnique({ where: { recurringEventId_occurrenceDate: { recurringEventId: id, occurrenceDate: date } } });
            if (existing?.deleted) throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrência excluída.');
            await tx.recurringOccurrence.deleteMany({
                where: { recurringEventId: id, occurrenceDate: date },
            });
            return resolveOccurrence(rule, date);
        });
    }
}
