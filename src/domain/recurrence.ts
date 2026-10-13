import { addDays, clampedDate, daysBetween } from './dates.js';

export interface RecurrenceRule {
    startDate: Date;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    interval: number;
    until: Date | null;
    count: number | null;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
}

/** Calculate every period from the original anchor; clamping never causes drift. */
export function dateAt(rule: RecurrenceRule, index: number): Date | null {
    if (index < 0 || !Number.isSafeInteger(index)) return null;
    const offset = index * rule.interval;
    const anchor = rule.startDate;
    switch (rule.frequency) {
        case 'DAILY':
        case 'WEEKLY': {
            const date = addDays(anchor, offset * (rule.frequency === 'WEEKLY' ? 7 : 1));
            return Number.isNaN(date.getTime()) || date.getUTCFullYear() > 9999 ? null : date;
        }
        case 'MONTHLY': {
            const months = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + offset;
            return clampedDate(Math.floor(months / 12), months % 12, anchor.getUTCDate());
        }
        case 'YEARLY':
            return clampedDate(
                anchor.getUTCFullYear() + offset,
                anchor.getUTCMonth(),
                anchor.getUTCDate(),
            );
    }
}

/** Seek directly to the requested period, even when the anchor is decades old. */
export function approximateIndex(rule: RecurrenceRule, date: Date): number {
    const start = rule.startDate;
    let periods: number;
    switch (rule.frequency) {
        case 'DAILY':
            periods = daysBetween(start, date);
            break;
        case 'WEEKLY':
            periods = daysBetween(start, date) / 7;
            break;
        case 'MONTHLY':
            periods =
                (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
                date.getUTCMonth() -
                start.getUTCMonth();
            break;
        case 'YEARLY':
            periods = date.getUTCFullYear() - start.getUTCFullYear();
            break;
    }
    return Math.max(0, Math.floor(periods / rule.interval));
}

export function occurrenceIndex(rule: RecurrenceRule, date: Date): number | null {
    if (
        date < rule.effectiveFrom ||
        (rule.effectiveUntil && date > rule.effectiveUntil) ||
        (rule.until && date > rule.until)
    )
        return null;
    const index = approximateIndex(rule, date);
    if (rule.count !== null && index >= rule.count) return null;
    return dateAt(rule, index)?.getTime() === date.getTime() ? index : null;
}

export function expandRecurrence(rule: RecurrenceRule, from: Date, to: Date): Date[] {
    const lower = new Date(
        Math.max(from.getTime(), rule.effectiveFrom.getTime(), rule.startDate.getTime()),
    );
    const upper = new Date(
        Math.min(
            to.getTime(),
            rule.until?.getTime() ?? Infinity,
            rule.effectiveUntil?.getTime() ?? Infinity,
        ),
    );
    if (lower > upper) return [];
    const dates: Date[] = [];
    for (
        let index = approximateIndex(rule, lower);
        rule.count === null || index < rule.count;
        index++
    ) {
        const date = dateAt(rule, index);
        if (!date || date > upper) break;
        if (date >= lower) dates.push(date);
    }
    return dates;
}

/** Find one original occurrence on or after a date without expanding the series. */
export function nextOccurrenceDate(rule: RecurrenceRule, from: Date): Date | null {
    const lower = new Date(
        Math.max(from.getTime(), rule.startDate.getTime(), rule.effectiveFrom.getTime()),
    );
    const upper = Math.min(
        rule.until?.getTime() ?? Infinity,
        rule.effectiveUntil?.getTime() ?? Infinity,
    );
    if (lower.getTime() > upper) return null;
    const first = approximateIndex(rule, lower);
    for (let index = first; index <= first + 1; index++) {
        if (rule.count !== null && index >= rule.count) return null;
        const date = dateAt(rule, index);
        if (!date || date.getTime() > upper) return null;
        if (date >= lower) return date;
    }
    return null;
}

/** Lifecycle used by both the filtered list and the detail's management actions. */
export function isActiveRecurrence(
    rule: RecurrenceRule,
    hasContinuation: boolean,
    currentDay: Date,
): boolean {
    return !hasContinuation && nextOccurrenceDate(rule, addDays(currentDay, 1)) !== null;
}
