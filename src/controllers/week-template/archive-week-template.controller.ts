import type { Request, Response } from 'express';
import { idSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { ArchiveWeekTemplateService } from '../../services/week-template/archive-week-template.service.js';

export class ArchiveWeekTemplateController {
    async handle(req: Request, res: Response) {
        const service = new ArchiveWeekTemplateService();
        await service.execute(userId(req), validated(req, idSchema).params.id);
        return res.sendStatus(204);
    }
}
