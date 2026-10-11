import { Router } from 'express';
import { CreateEventController } from '../controllers/event/create-event.controller.js';
import { validateSchema } from '../middlewares/validate-schema.js';
import { createEventSchema, updateEventSchema } from '../schemas/event.schema.js';
import { GetEventController } from '../controllers/event/get-event.controller.js';
import { idSchema, calendarSchema } from '../schemas/common.schema.js';
import { ListEventsController } from '../controllers/event/list-events.controller.js';
import { UpdateEventController } from '../controllers/event/update-event.controller.js';
import { DeleteEventController } from '../controllers/event/delete-event.controller.js';

const eventRoutes = Router();

eventRoutes.post('/', validateSchema(createEventSchema), new CreateEventController().handle);

eventRoutes.get('/:id', validateSchema(idSchema), new GetEventController().handle);

eventRoutes.get('/', validateSchema(calendarSchema), new ListEventsController().handle);

eventRoutes.patch('/:id', validateSchema(updateEventSchema), new UpdateEventController().handle);

eventRoutes.delete('/:id', validateSchema(idSchema), new DeleteEventController().handle);

export default eventRoutes;
