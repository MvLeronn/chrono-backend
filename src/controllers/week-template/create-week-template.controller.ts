import type { Request, Response } from 'express';
import { createTemplateSchema } from '../../schemas/template.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { CreateWeekTemplateService } from '../../services/week-template/create-week-template.service.js';

export class CreateWeekTemplateController {
    async handle(req: Request, res: Response) {
        const service = new CreateWeekTemplateService();
        return res
            .status(201)
            .json(await service.execute(userId(req), validated(req, createTemplateSchema).body));
    }
}
