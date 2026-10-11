import type { Request, Response } from 'express';
import { listSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { ListRecurringEventsService } from '../../services/recurring-event/list-recurring-events.service.js';

export class ListRecurringEventsController {
    async handle(req: Request, res: Response) {
        const service = new ListRecurringEventsService();
        const { page, limit } = validated(req, listSchema).query;
        return res.json(await service.execute(userId(req), page, limit));
    }
}
