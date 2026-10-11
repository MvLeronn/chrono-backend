import { Router } from 'express';
import { GetRecurringOccurrenceController } from '../controllers/recurring-occurrence/get-recurring-occurrence.controller.js';
import { validateSchema } from '../middlewares/validate-schema.js';
import { getOccurrenceSchema, updateOccurrenceSchema } from '../schemas/recurring.schema.js';
import { UpdateRecurringOccurrenceController } from '../controllers/recurring-occurrence/update-recurring-occurrence.controller.js';
import { ResetRecurringOccurrenceController } from '../controllers/recurring-occurrence/reset-recurring-occurrence.controller.js';

const recurringOccurrenceRoutes = Router();

recurringOccurrenceRoutes.get(
    '/:id/occurrences/:occurrenceDate',
    validateSchema(getOccurrenceSchema),
    new GetRecurringOccurrenceController().handle,
);

recurringOccurrenceRoutes.patch(
    '/:id/occurrences/:occurrenceDate',
    validateSchema(updateOccurrenceSchema),
    new UpdateRecurringOccurrenceController().handle,
);

recurringOccurrenceRoutes.delete(
    '/:id/occurrences/:occurrenceDate/state',
    validateSchema(getOccurrenceSchema),
    new ResetRecurringOccurrenceController().handle,
);

export default recurringOccurrenceRoutes;
