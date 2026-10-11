import type { RecurringEvent } from '../../../generated/prisma/client.js';
import { AppError } from '../../../domain/errors.js';
import { occurrenceIndex } from '../../../domain/recurrence.js';

export function assertOccurrence(rule: RecurringEvent, date: Date) {
    if (occurrenceIndex(rule, date) === null)
        throw new AppError(
            404,
            'OCCURRENCE_NOT_FOUND',
            'Esta data não corresponde a uma ocorrência da regra.',
        );
}
