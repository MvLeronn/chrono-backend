import { serializeRule } from '../../domain/activity.js';
import { addDays, dateString, parseDate, parseTime } from '../../domain/dates.js';
import { AppError } from '../../domain/errors.js';
import { occurrenceIndex } from '../../domain/recurrence.js';
import type { RecurringInput } from '../../schemas/recurring.schema.js';
import { transaction } from '../shared/transaction.js';
import { assertRule } from './shared/assert-rule.js';
import { ownedRule } from './shared/get-owned-rule.js';
import { assertOccurrence } from './shared/assert-occurrence.js';
import { assertFutureBoundary } from './shared/assert-future-boundary.js';

export class SplitRecurringEventService {
    async execute(userId: string, id: string, dateValue: string, changes: Partial<RecurringInput>) {
        return transaction(async (tx) => {
            const current = await ownedRule(tx, userId, id);
            const boundary = parseDate(dateValue);
            await assertFutureBoundary(tx, userId, boundary);
            assertOccurrence(current, boundary);
            if (await tx.recurringEvent.findUnique({ where: { previousId: id } })) {
                throw new AppError(
                    409,
                    'SERIES_ALREADY_SPLIT',
                    'Esta regra já possui uma continuação. Altere o segmento correspondente.',
                );
            }
            const reanchor =
                changes.startDate !== undefined ||
                (changes.frequency !== undefined && changes.frequency !== current.frequency) ||
                (changes.interval !== undefined && changes.interval !== current.interval);
            const startDate = changes.startDate
                ? parseDate(changes.startDate)
                : reanchor
                  ? boundary
                  : current.startDate;
            if (reanchor && startDate < boundary)
                throw new AppError(
                    400,
                    'INVALID_START_DATE',
                    'A nova data inicial não pode anteceder a divisão da série.',
                );
            const index = occurrenceIndex(current, boundary)!;
            let count =
                changes.count === undefined
                    ? reanchor && current.count !== null
                        ? current.count - index
                        : current.count
                    : changes.count;
            let until =
                changes.until === undefined
                    ? current.until
                    : changes.until === null
                      ? null
                      : parseDate(changes.until);
            if (changes.count != null && changes.until === undefined) until = null;
            if (changes.until != null && changes.count === undefined) count = null;
            const data = {
                userId,
                seriesId: current.seriesId,
                previousId: id,
                type: changes.type ?? current.type,
                title: changes.title ?? current.title,
                description:
                    changes.description === undefined ? current.description : changes.description,
                startDate,
                effectiveFrom: boundary,
                effectiveUntil: current.effectiveUntil,
                startTime:
                    changes.startTime === undefined
                        ? current.startTime
                        : parseTime(changes.startTime),
                endTime:
                    changes.endTime === undefined ? current.endTime : parseTime(changes.endTime),
                frequency: changes.frequency ?? current.frequency,
                interval: changes.interval ?? current.interval,
                until,
                count,
            };
            assertRule(data);
            if (until && until < boundary)
                throw new AppError(
                    400,
                    'INVALID_TERMINATION',
                    'A nova regra deve terminar após o início do segmento.',
                );
            const saved = await tx.recurringOccurrence.findMany({
                where: { recurringEventId: id, occurrenceDate: { gte: boundary } },
            });
            const conflicts = saved.filter(
                (item) => occurrenceIndex(data, item.occurrenceDate) === null,
            );
            if (conflicts.length)
                throw new AppError(
                    409,
                    'OCCURRENCE_CONFLICT',
                    'A alteração deixaria ocorrências personalizadas fora da regra. Ajuste a alteração ou redefina explicitamente essas ocorrências.',
                    {
                        occurrences: conflicts.map((item) => ({
                            occurrenceDate: dateString(item.occurrenceDate),
                            status: item.status,
                        })),
                    },
                );
            const next = await tx.recurringEvent.create({ data });
            for (const item of saved) {
                // Completed history keeps its resolved content, including future-dated work completed early.
                const frozen =
                    item.status === 'COMPLETED'
                        ? {
                              typeOverride: item.typeOverride ?? current.type,
                              titleOverride: item.titleOverride ?? current.title,
                              descriptionOverride:
                                  item.descriptionOverride ?? current.description ?? '',
                              hasTimeOverride: true,
                              startTimeOverride: item.hasTimeOverride
                                  ? item.startTimeOverride
                                  : current.startTime,
                              endTimeOverride: item.hasTimeOverride
                                  ? item.endTimeOverride
                                  : current.endTime,
                          }
                        : {};
                await tx.recurringOccurrence.update({
                    where: { id: item.id },
                    data: { recurringEventId: next.id, ...frozen },
                });
            }
            await tx.recurringEvent.update({
                where: { id },
                data: { effectiveUntil: addDays(boundary, -1) },
            });
            return serializeRule(next);
        });
    }
}
