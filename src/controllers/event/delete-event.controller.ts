import type { Request, Response } from 'express';
import { idSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { DeleteEventService } from '../../services/event/delete-event.service.js';

export class DeleteEventController {
    async handle(req: Request, res: Response) {
        const service = new DeleteEventService();
        await service.execute(userId(req), validated(req, idSchema).params.id);
        return res.sendStatus(204);
    }
}
