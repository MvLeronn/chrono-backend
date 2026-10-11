import prisma from '../../prisma/index.js';
import { serialize } from './shared/serialize-template.js';
import { include } from './shared/template-include.js';

export class ListWeekTemplatesService {
    async execute(userId: string, page: number, limit: number) {
        const where = { userId, archivedAt: null };
        const [items, total] = await prisma.$transaction([
            prisma.weekTemplate.findMany({
                where,
                include,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            }),
            prisma.weekTemplate.count({ where }),
        ]);
        return { items: items.map(serialize), total, page, limit };
    }
}
