import type { Request, Response } from 'express';
import { updateTemplateSchema } from '../../schemas/template.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { UpdateWeekTemplateService } from '../../services/week-template/update-week-template.service.js';

export class UpdateWeekTemplateController {
    async handle(req: Request, res: Response) {
        const service = new UpdateWeekTemplateService();
        const { body, params } = validated(req, updateTemplateSchema);
        return res.json(await service.execute(userId(req), params.id, body));
    }
}
