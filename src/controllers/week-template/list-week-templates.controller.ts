import type { Request, Response } from 'express';
import { listSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { ListWeekTemplatesService } from '../../services/week-template/list-week-templates.service.js';

export class ListWeekTemplatesController {
    async handle(req: Request, res: Response) {
        const service = new ListWeekTemplatesService();
        const { page, limit } = validated(req, listSchema).query;
        return res.json(await service.execute(userId(req), page, limit));
    }
}
