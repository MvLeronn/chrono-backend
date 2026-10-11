import prisma from '../../prisma/index.js';
import { Prisma } from '../../generated/prisma/client.js';

export async function transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            // Writers lock their resource before reading. READ COMMITTED sees the
            // preceding writer's result even when this transaction waited for a lock.
            return await prisma.$transaction(work, {
                isolationLevel: 'ReadCommitted',
                maxWait: 10000,
                timeout: 20000,
            });
        } catch (error) {
            if (
                !(error instanceof Prisma.PrismaClientKnownRequestError) ||
                error.code !== 'P2034' ||
                attempt >= 3
            )
                throw error;
        }
    }
}
