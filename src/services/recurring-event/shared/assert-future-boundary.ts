import type { Prisma } from '../../../generated/prisma/client.js';
import { today } from '../../../domain/dates.js';
import { AppError } from '../../../domain/errors.js';

export async function assertFutureBoundary(
    tx: Prisma.TransactionClient,
    userId: string,
    date: Date,
) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (date < today(user.timezone))
        throw new AppError(
            400,
            'HISTORY_PROTECTED',
            'Altere ocorrências passadas individualmente. Mudanças na série começam hoje ou no futuro.',
        );
}
