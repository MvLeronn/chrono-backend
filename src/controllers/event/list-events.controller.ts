import type { Request, Response } from 'express';
import { calendarSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { ListEventsService } from '../../services/event/list-events.service.js';

export class ListEventsController {
    async handle(req: Request, res: Response) {
        const service = new ListEventsService();
        const { query } = validated(req, calendarSchema);
        return res.json({ items: await service.execute(userId(req), query.from, query.to) });
    }
}
