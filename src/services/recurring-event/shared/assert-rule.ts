import type { RecurringEvent } from '../../../generated/prisma/client.js';
import { assertTimeRange } from '../../../domain/activity.js';
import { AppError } from '../../../domain/errors.js';

export function assertRule(
    rule: Pick<RecurringEvent, 'startDate' | 'until' | 'count' | 'startTime' | 'endTime'>,
) {
    assertTimeRange(rule.startTime, rule.endTime);
    if (rule.until && rule.count !== null)
        throw new AppError(
            400,
            'INVALID_TERMINATION',
            'Escolha data final ou quantidade de ocorrências.',
        );
    if (rule.until && rule.until < rule.startDate)
        throw new AppError(
            400,
            'INVALID_TERMINATION',
            'A data final deve ser igual ou posterior à inicial.',
        );
}
