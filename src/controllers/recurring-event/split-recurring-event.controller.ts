import type { Request, Response } from 'express';
import { splitRecurringSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { SplitRecurringEventService } from '../../services/recurring-event/split-recurring-event.service.js';

export class SplitRecurringEventController {
    async handle(req: Request, res: Response) {
        const service = new SplitRecurringEventService();
        const { body, params } = validated(req, splitRecurringSchema);
        return res
            .status(201)
            .json(await service.execute(userId(req), params.id, body.fromDate, body.changes));
    }
}
