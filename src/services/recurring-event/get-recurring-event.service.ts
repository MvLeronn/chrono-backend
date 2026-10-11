import prisma from '../../prisma/index.js';
import { serializeRule } from '../../domain/activity.js';
import { notFound } from '../../domain/errors.js';

export class GetRecurringEventService {
    async execute(userId: string, id: string) {
        return serializeRule(
            (await prisma.recurringEvent.findFirst({ where: { id, userId } })) ?? notFound(),
        );
    }
}
