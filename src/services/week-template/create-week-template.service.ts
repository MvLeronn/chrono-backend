import prisma from '../../prisma/index.js';
import type { TemplateInput } from '../../schemas/template.schema.js';
import { itemData } from './shared/build-template-item.js';
import { serialize } from './shared/serialize-template.js';
import { include } from './shared/template-include.js';

export class CreateWeekTemplateService {
    async execute(userId: string, input: TemplateInput) {
        return serialize(
            await prisma.weekTemplate.create({
                data: { userId, name: input.name, items: { create: input.items.map(itemData) } },
                include,
            }),
        );
    }
}
