import type { Request, Response } from 'express';
import { idSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { GetEventService } from '../../services/event/get-event.service.js';

export class GetEventController {
    async handle(req: Request, res: Response) {
        const service = new GetEventService();
        return res.json(await service.execute(userId(req), validated(req, idSchema).params.id));
    }
}
