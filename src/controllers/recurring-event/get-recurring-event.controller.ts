import type { Request, Response } from 'express';
import { idSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { GetRecurringEventService } from '../../services/recurring-event/get-recurring-event.service.js';

export class GetRecurringEventController {
    async handle(req: Request, res: Response) {
        const service = new GetRecurringEventService();
        return res.json(await service.execute(userId(req), validated(req, idSchema).params.id));
    }
}
