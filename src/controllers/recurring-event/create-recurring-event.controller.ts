import type { Request, Response } from 'express';
import { createRecurringSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { CreateRecurringEventService } from '../../services/recurring-event/create-recurring-event.service.js';

export class CreateRecurringEventController {
    async handle(req: Request, res: Response) {
        const service = new CreateRecurringEventService();
        return res
            .status(201)
            .json(await service.execute(userId(req), validated(req, createRecurringSchema).body));
    }
}
