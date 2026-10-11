import type { Request, Response } from 'express';
import { getOccurrenceSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { GetRecurringOccurrenceService } from '../../services/recurring-occurrence/get-recurring-occurrence.service.js';

export class GetRecurringOccurrenceController {
    async handle(req: Request, res: Response) {
        const service = new GetRecurringOccurrenceService();
        const { params } = validated(req, getOccurrenceSchema);
        return res.json(await service.execute(userId(req), params.id, params.occurrenceDate));
    }
}
