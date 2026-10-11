import prisma from '../../prisma/index.js';
import { notFound } from '../../domain/errors.js';
import { serialize } from './shared/serialize-template.js';
import { include } from './shared/template-include.js';

export class GetWeekTemplateService {
    async execute(userId: string, id: string) {
        return serialize(
            (await prisma.weekTemplate.findFirst({
                where: { id, userId, archivedAt: null },
                include,
            })) ?? notFound(),
        );
    }
}
