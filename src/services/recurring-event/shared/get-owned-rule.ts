import type { Prisma } from '../../../generated/prisma/client.js';
import { notFound } from '../../../domain/errors.js';
import { lock } from '../../shared/lock.js';

export async function ownedRule(tx: Prisma.TransactionClient, userId: string, id: string) {
    await lock(tx, `recurring:${id}`);
    return (await tx.recurringEvent.findFirst({ where: { id, userId } })) ?? notFound();
}
