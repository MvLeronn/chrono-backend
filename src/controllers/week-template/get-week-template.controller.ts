import type { Request, Response } from 'express';
import { idSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { GetWeekTemplateService } from '../../services/week-template/get-week-template.service.js';

export class GetWeekTemplateController {
    async handle(req: Request, res: Response) {
        const service = new GetWeekTemplateService();
        return res.json(await service.execute(userId(req), validated(req, idSchema).params.id));
    }
}
