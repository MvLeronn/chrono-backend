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
            await tx.recurringOccurrence.deleteMany({
                where: { recurringEventId: id, occurrenceDate: date },
            });
            return resolveOccurrence(rule, date);
        });
    }
}
