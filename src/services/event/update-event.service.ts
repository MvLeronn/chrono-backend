import { assertTimeRange, completionTime, serializeEvent } from '../../domain/activity.js';
import { parseDate, parseTime } from '../../domain/dates.js';
import { notFound } from '../../domain/errors.js';
import type { EventInput } from '../../schemas/event.schema.js';
import { lock } from '../shared/lock.js';
import { transaction } from '../shared/transaction.js';

export class UpdateEventService {
    async execute(userId: string, id: string, input: Partial<EventInput>) {
        return transaction(async (tx) => {
            await lock(tx, `event:${id}`);
            const current = (await tx.event.findFirst({ where: { id, userId } })) ?? notFound();
            const startTime =
                input.startTime === undefined ? current.startTime : parseTime(input.startTime);
            const endTime =
                input.endTime === undefined ? current.endTime : parseTime(input.endTime);
            assertTimeRange(startTime, endTime);
            const status = input.status ?? current.status;
            return serializeEvent(
                await tx.event.update({
                    where: { id },
                    data: {
                        type: input.type,
                        title: input.title,
                        description: input.description,
                        date: input.date ? parseDate(input.date) : undefined,
                        startTime,
                        endTime,
                        status,
                        completedAt: completionTime(status, current.completedAt),
                    },
                }),
            );
        });
    }
}
