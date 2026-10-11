import type { Request, Response } from 'express';
import { applyTemplateSchema } from '../../schemas/template.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { ApplyWeekTemplateService } from '../../services/week-template/apply-week-template.service.js';

export class ApplyWeekTemplateController {
    async handle(req: Request, res: Response) {
        const service = new ApplyWeekTemplateService();
        const { body, params } = validated(req, applyTemplateSchema);
        const result = await service.execute(userId(req), params.id, body.weekStart);
        return res.status(result.alreadyApplied ? 200 : 201).json(result);
    }
}
