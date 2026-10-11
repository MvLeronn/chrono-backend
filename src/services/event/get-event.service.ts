import prisma from '../../prisma/index.js';
import { serializeEvent } from '../../domain/activity.js';
import { notFound } from '../../domain/errors.js';

export class GetEventService {
    async execute(userId: string, id: string) {
        const event = (await prisma.event.findFirst({ where: { id, userId } })) ?? notFound();
        return serializeEvent(event);
    }
}
