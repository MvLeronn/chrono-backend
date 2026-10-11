import type { Request, Response } from 'express';
import { endRecurringSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { EndRecurringEventService } from '../../services/recurring-event/end-recurring-event.service.js';

export class EndRecurringEventController {
    async handle(req: Request, res: Response) {
        const service = new EndRecurringEventService();
        const { body, params } = validated(req, endRecurringSchema);
        return res.json(await service.execute(userId(req), params.id, body.fromDate));
    }
}
