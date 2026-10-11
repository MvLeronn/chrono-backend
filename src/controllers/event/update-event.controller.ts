import type { Request, Response } from 'express';
import { updateEventSchema } from '../../schemas/event.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { UpdateEventService } from '../../services/event/update-event.service.js';

export class UpdateEventController {
    async handle(req: Request, res: Response) {
        const service = new UpdateEventService();
        const { body, params } = validated(req, updateEventSchema);
        return res.json(await service.execute(userId(req), params.id, body));
    }
}
