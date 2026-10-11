import type { Request, Response } from 'express';
import { getOccurrenceSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { ResetRecurringOccurrenceService } from '../../services/recurring-occurrence/reset-recurring-occurrence.service.js';

export class ResetRecurringOccurrenceController {
    async handle(req: Request, res: Response) {
        const service = new ResetRecurringOccurrenceService();
        const { params } = validated(req, getOccurrenceSchema);
        return res.json(await service.execute(userId(req), params.id, params.occurrenceDate));
    }
}
