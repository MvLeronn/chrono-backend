import { notFound } from '../../domain/errors.js';
import { lock } from '../shared/lock.js';
import { transaction } from '../shared/transaction.js';

export class ArchiveWeekTemplateService {
    async execute(userId: string, id: string) {
        return transaction(async (tx) => {
            await lock(tx, `template:${id}`);
            const result = await tx.weekTemplate.updateMany({
                where: { id, userId, archivedAt: null },
                data: { archivedAt: new Date() },
            });
            if (!result.count) notFound();
        });
    }
}
