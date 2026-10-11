import type { Request, Response } from 'express';
import { createEventSchema } from '../../schemas/event.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { CreateEventService } from '../../services/event/create-event.service.js';

export class CreateEventController {
    async handle(req: Request, res: Response) {
        const service = new CreateEventService();
        return res
            .status(201)
            .json(await service.execute(userId(req), validated(req, createEventSchema).body));
    }
}
