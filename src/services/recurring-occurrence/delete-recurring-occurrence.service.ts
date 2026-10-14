import { parseDate } from '../../domain/dates.js';
import { transaction } from '../shared/transaction.js';
import { ownedRule } from '../recurring-event/shared/get-owned-rule.js';
import { assertOccurrence } from '../recurring-event/shared/assert-occurrence.js';

export class DeleteRecurringOccurrenceService {
    async execute(userId: string, id: string, dateValue: string) {
        return transaction(async (tx) => {
            const rule = await ownedRule(tx, userId, id);
            const occurrenceDate = parseDate(dateValue);
            assertOccurrence(rule, occurrenceDate);
            // Keep only the exclusion marker so expansion cannot recreate this day.
            const data = {
                deleted: true,
                scheduledDate: occurrenceDate,
                status: 'PENDING' as const,
                completedAt: null,
                typeOverride: null,
                titleOverride: null,
                descriptionOverride: null,
                hasTimeOverride: false,
                startTimeOverride: null,
                endTimeOverride: null,
            };
            await tx.recurringOccurrence.upsert({
                where: { recurringEventId_occurrenceDate: { recurringEventId: id, occurrenceDate } },
                create: { recurringEventId: id, occurrenceDate, ...data },
                update: data,
            });
        });
    }
}
