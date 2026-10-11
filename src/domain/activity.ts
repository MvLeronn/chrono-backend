import type {
    ActivityStatus,
    Event,
    RecurringEvent,
    RecurringOccurrence,
} from '../generated/prisma/client.js';
import { dateString, timeString } from './dates.js';
import { AppError } from './errors.js';

export function completionTime(
    status: ActivityStatus,
    previous: Date | null,
    now = new Date(),
): Date | null {
    return status === 'COMPLETED' ? (previous ?? now) : null;
}

export function assertTimeRange(start: Date | null, end: Date | null): void {
    if (end && (!start || end <= start)) {
        throw new AppError(
            400,
            'INVALID_TIME_RANGE',
            'O horário final deve ser posterior ao inicial, no mesmo dia.',
        );
    }
}

export function serializeEvent(event: Event) {
    return {
        id: event.id,
        calendarKey: `event:${event.id}`,
        source: 'EVENT' as const,
        type: event.type,
        title: event.title,
        description: event.description,
        date: dateString(event.date),
        startTime: timeString(event.startTime),
        endTime: timeString(event.endTime),
        status: event.status,
        completedAt: event.completedAt,
        templateApplicationId: event.templateApplicationId,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
    };
}

export function resolveOccurrence(
    rule: RecurringEvent,
    date: Date,
    saved?: RecurringOccurrence | null,
) {
    return {
        id: saved?.id ?? null,
        calendarKey: `recurring:${rule.seriesId}:${dateString(date)}`,
        source: 'RECURRING' as const,
        recurringEventId: rule.id,
        seriesId: rule.seriesId,
        occurrenceDate: dateString(date),
        date: dateString(saved?.scheduledDate ?? date),
        type: saved?.typeOverride ?? rule.type,
        title: saved?.titleOverride ?? rule.title,
        description: saved?.descriptionOverride ?? rule.description,
        startTime: timeString(saved?.hasTimeOverride ? saved.startTimeOverride : rule.startTime),
        endTime: timeString(saved?.hasTimeOverride ? saved.endTimeOverride : rule.endTime),
        status: saved?.status ?? 'PENDING',
        completedAt: saved?.completedAt ?? null,
    };
}

export function serializeRule(rule: RecurringEvent) {
    return {
        ...rule,
        startDate: dateString(rule.startDate),
        startTime: timeString(rule.startTime),
        endTime: timeString(rule.endTime),
        until: rule.until ? dateString(rule.until) : null,
        effectiveFrom: dateString(rule.effectiveFrom),
        effectiveUntil: rule.effectiveUntil ? dateString(rule.effectiveUntil) : null,
        invalidDatePolicy: 'LAST_VALID_DAY',
    };
}
