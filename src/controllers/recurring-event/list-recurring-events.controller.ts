import type { Request, Response } from 'express';
import { recurringListSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { ListRecurringEventsService } from '../../services/recurring-event/list-recurring-events.service.js';

export class ListRecurringEventsController {
    async handle(req: Request, res: Response) {
        const service = new ListRecurringEventsService();
        const { page, limit, status } = validated(req, recurringListSchema).query;
        return res.json(await service.execute(userId(req), page, limit, status));
    }
}
