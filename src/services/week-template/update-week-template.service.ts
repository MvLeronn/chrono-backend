import { notFound } from '../../domain/errors.js';
import type { TemplateInput } from '../../schemas/template.schema.js';
import { lock } from '../shared/lock.js';
import { transaction } from '../shared/transaction.js';
import { itemData } from './shared/build-template-item.js';
import { serialize } from './shared/serialize-template.js';
import { include } from './shared/template-include.js';

export class UpdateWeekTemplateService {
    async execute(userId: string, id: string, input: Partial<TemplateInput>) {
        return transaction(async (tx) => {
            await lock(tx, `template:${id}`);
            (await tx.weekTemplate.findFirst({ where: { id, userId, archivedAt: null } })) ??
                notFound();
            return serialize(
                await tx.weekTemplate.update({
                    where: { id },
                    data: {
                        name: input.name,
                        items: input.items
                            ? { deleteMany: {}, create: input.items.map(itemData) }
                            : undefined,
                    },
                    include,
                }),
            );
        });
    }
}
