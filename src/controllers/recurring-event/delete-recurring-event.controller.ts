import type { Request, Response } from 'express';
import { idSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { DeleteRecurringEventService } from '../../services/recurring-event/delete-recurring-event.service.js';

export class DeleteRecurringEventController {
    async handle(req: Request, res: Response) {
        await new DeleteRecurringEventService().execute(
            userId(req),
            validated(req, idSchema).params.id,
        );
        return res.sendStatus(204);
    }
}
