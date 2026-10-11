import prisma from '../../prisma/index.js';
import { notFound } from '../../domain/errors.js';

export class DeleteEventService {
    async execute(userId: string, id: string) {
        const result = await prisma.event.deleteMany({ where: { id, userId } });
        if (!result.count) notFound();
    }
}
