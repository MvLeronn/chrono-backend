import { Router } from 'express';
import { CreateRecurringEventController } from '../controllers/recurring-event/create-recurring-event.controller.js';
import { validateSchema } from '../middlewares/validate-schema.js';
import {
    createRecurringSchema,
    splitRecurringSchema,
    endRecurringSchema,
    recurringListSchema,
} from '../schemas/recurring.schema.js';
import { GetRecurringEventController } from '../controllers/recurring-event/get-recurring-event.controller.js';
import { idSchema } from '../schemas/common.schema.js';
import { ListRecurringEventsController } from '../controllers/recurring-event/list-recurring-events.controller.js';
import { SplitRecurringEventController } from '../controllers/recurring-event/split-recurring-event.controller.js';
import { EndRecurringEventController } from '../controllers/recurring-event/end-recurring-event.controller.js';

const recurringEventRoutes = Router();

recurringEventRoutes.post(
    '/',
    validateSchema(createRecurringSchema),
    new CreateRecurringEventController().handle,
);

recurringEventRoutes.get(
    '/:id',
    validateSchema(idSchema),
    new GetRecurringEventController().handle,
);

recurringEventRoutes.get(
    '/',
    validateSchema(recurringListSchema),
    new ListRecurringEventsController().handle,
);

recurringEventRoutes.post(
    '/:id/split',
    validateSchema(splitRecurringSchema),
    new SplitRecurringEventController().handle,
);

recurringEventRoutes.post(
    '/:id/end',
    validateSchema(endRecurringSchema),
    new EndRecurringEventController().handle,
);

export default recurringEventRoutes;
