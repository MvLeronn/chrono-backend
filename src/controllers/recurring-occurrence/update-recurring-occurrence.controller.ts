import type { Request, Response } from 'express';
import { updateOccurrenceSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { UpdateRecurringOccurrenceService } from '../../services/recurring-occurrence/update-recurring-occurrence.service.js';

export class UpdateRecurringOccurrenceController {
    async handle(req: Request, res: Response) {
        const service = new UpdateRecurringOccurrenceService();
        const { params, body } = validated(req, updateOccurrenceSchema);
        return res.json(await service.execute(userId(req), params.id, params.occurrenceDate, body));
    }
}
