import prisma from '../../prisma/index.js';
import { notFound } from '../../domain/errors.js';

export class GetCurrentUserService {
    async execute(id: string) {
        return (
            (await prisma.user.findUnique({
                where: { id },
                select: { id: true, timezone: true },
            })) ?? notFound()
        );
    }
}
