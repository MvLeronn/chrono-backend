import { AppError } from '../../domain/errors.js';
import { assertTimeRange, completionTime, resolveOccurrence } from '../../domain/activity.js';
import { parseDate, parseTime } from '../../domain/dates.js';
import type { OccurrenceInput } from '../../schemas/recurring.schema.js';
import { transaction } from '../shared/transaction.js';
import { ownedRule } from '../recurring-event/shared/get-owned-rule.js';
import { assertOccurrence } from '../recurring-event/shared/assert-occurrence.js';

export class UpdateRecurringOccurrenceService {
    async execute(userId: string, id: string, dateValue: string, input: OccurrenceInput) {
        return transaction(async (tx) => {
            const rule = await ownedRule(tx, userId, id);
            const occurrenceDate = parseDate(dateValue);
            assertOccurrence(rule, occurrenceDate);
            const where = {
                recurringEventId_occurrenceDate: { recurringEventId: id, occurrenceDate },
            };
            const existing = await tx.recurringOccurrence.findUnique({ where });
            if (existing?.deleted) throw new AppError(404, 'OCCURRENCE_NOT_FOUND', 'Ocorrência excluída.');
            const status = input.status ?? existing?.status ?? 'PENDING';
            const timeData =
                input.timeOverride === undefined
                    ? {}
                    : {
                          hasTimeOverride: input.timeOverride !== null,
                          startTimeOverride: parseTime(input.timeOverride?.startTime),
                          endTimeOverride: parseTime(input.timeOverride?.endTime),
                      };
            if (input.timeOverride)
                assertTimeRange(
                    parseTime(input.timeOverride.startTime),
                    parseTime(input.timeOverride.endTime),
                );
            const data = {
                scheduledDate: input.scheduledDate
                    ? parseDate(input.scheduledDate)
                    : (existing?.scheduledDate ?? occurrenceDate),
                status,
                completedAt: completionTime(status, existing?.completedAt ?? null),
                typeOverride: input.typeOverride,
                titleOverride: input.titleOverride,
                descriptionOverride: input.descriptionOverride,
                ...timeData,
            };
            const saved = await tx.recurringOccurrence.upsert({
                where,
                create: { recurringEventId: id, occurrenceDate, ...data },
                update: data,
            });
            return resolveOccurrence(rule, occurrenceDate, saved);
        });
    }
}
