import { serializeEvent } from '../../domain/activity.js';
import { addDays, dateString, parseDate } from '../../domain/dates.js';
import { AppError, notFound } from '../../domain/errors.js';
import { lock } from '../shared/lock.js';
import { transaction } from '../shared/transaction.js';
import { include } from './shared/template-include.js';

export class ApplyWeekTemplateService {
    async execute(userId: string, id: string, week: string) {
        const weekStart = parseDate(week);
        if (weekStart.getUTCDay() !== 1)
            throw new AppError(
                400,
                'INVALID_WEEK_START',
                'A semana deve começar na segunda-feira.',
            );
        if (addDays(weekStart, 6).getUTCFullYear() > 9999)
            throw new AppError(
                400,
                'INVALID_WEEK_START',
                'A semana ultrapassa o limite do calendário.',
            );
        return transaction(async (tx) => {
            await lock(tx, `template:${id}`);
            const template =
                (await tx.weekTemplate.findFirst({
                    where: { id, userId, archivedAt: null },
                    include,
                })) ?? notFound();
            const existing = await tx.weekTemplateApplication.findUnique({
                where: { templateId_weekStart: { templateId: id, weekStart } },
                include: { events: true },
            });
            if (existing)
                return {
                    id: existing.id,
                    weekStart: dateString(existing.weekStart),
                    alreadyApplied: true,
                    events: existing.events.map(serializeEvent),
                };
            const application = await tx.weekTemplateApplication.create({
                data: { templateId: id, weekStart },
            });
            await tx.event.createMany({
                data: template.items.map((item) => ({
                    userId,
                    templateApplicationId: application.id,
                    type: item.type,
                    title: item.title,
                    description: item.description,
                    date: addDays(weekStart, item.weekday - 1),
                    startTime: item.startTime,
                    endTime: item.endTime,
                })),
            });
            const events = await tx.event.findMany({
                where: { templateApplicationId: application.id },
                orderBy: [{ date: 'asc' }, { id: 'asc' }],
            });
            return {
                id: application.id,
                weekStart: week,
                alreadyApplied: false,
                events: events.map(serializeEvent),
            };
        });
    }
}
