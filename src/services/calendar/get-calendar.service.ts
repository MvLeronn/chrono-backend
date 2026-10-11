import prisma from '../../prisma/index.js';
import { resolveOccurrence, serializeEvent } from '../../domain/activity.js';
import { dateString, parseDate } from '../../domain/dates.js';
import { expandRecurrence, occurrenceIndex } from '../../domain/recurrence.js';

export class GetCalendarService {
    async execute(userId: string, fromValue: string, toValue: string) {
        const from = parseDate(fromValue),
            to = parseDate(toValue);
        return prisma.$transaction(
            async (tx) => {
                const [events, rules, user] = await Promise.all([
                    tx.event.findMany({ where: { userId, date: { gte: from, lte: to } } }),
                    tx.recurringEvent.findMany({
                        where: {
                            userId,
                            OR: [
                                {
                                    effectiveFrom: { lte: to },
                                    OR: [
                                        { effectiveUntil: null },
                                        { effectiveUntil: { gte: from } },
                                    ],
                                },
                                {
                                    occurrences: {
                                        some: { scheduledDate: { gte: from, lte: to } },
                                    },
                                },
                            ],
                        },
                        include: {
                            occurrences: {
                                where: {
                                    OR: [
                                        { occurrenceDate: { gte: from, lte: to } },
                                        { scheduledDate: { gte: from, lte: to } },
                                    ],
                                },
                            },
                        },
                    }),
                    tx.user.findUniqueOrThrow({
                        where: { id: userId },
                        select: { timezone: true },
                    }),
                ]);
                const items: Array<
                    ReturnType<typeof serializeEvent> | ReturnType<typeof resolveOccurrence>
                > = events.map(serializeEvent);
                for (const rule of rules) {
                    const saved = new Map(
                        rule.occurrences.map((item) => [dateString(item.occurrenceDate), item]),
                    );
                    const resolved = new Map<string, ReturnType<typeof resolveOccurrence>>();
                    for (const date of expandRecurrence(rule, from, to)) {
                        const key = dateString(date);
                        resolved.set(key, resolveOccurrence(rule, date, saved.get(key)));
                    }
                    for (const item of rule.occurrences) {
                        if (occurrenceIndex(rule, item.occurrenceDate) !== null) {
                            resolved.set(
                                dateString(item.occurrenceDate),
                                resolveOccurrence(rule, item.occurrenceDate, item),
                            );
                        }
                    }
                    for (const item of resolved.values()) {
                        if (item.date >= fromValue && item.date <= toValue) items.push(item);
                    }
                }
                items.sort(
                    (a, b) =>
                        a.date.localeCompare(b.date) ||
                        (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
                        a.calendarKey.localeCompare(b.calendarKey),
                );
                return { from: fromValue, to: toValue, timezone: user.timezone, items };
            },
            { isolationLevel: 'RepeatableRead', timeout: 20000 },
        );
    }
}
