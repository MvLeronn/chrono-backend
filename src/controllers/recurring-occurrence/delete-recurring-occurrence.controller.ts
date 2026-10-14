import type { Request, Response } from 'express';
import { getOccurrenceSchema } from '../../schemas/recurring.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { DeleteRecurringOccurrenceService } from '../../services/recurring-occurrence/delete-recurring-occurrence.service.js';

export class DeleteRecurringOccurrenceController {
    async handle(req: Request, res: Response) {
        const service = new DeleteRecurringOccurrenceService();
        const { params } = validated(req, getOccurrenceSchema);
        await service.execute(userId(req), params.id, params.occurrenceDate);
        return res.status(204).send();
    }
}
