import { Router } from 'express';
import { GetCalendarController } from '../controllers/calendar/get-calendar.controller.js';
import { validateSchema } from '../middlewares/validate-schema.js';
import { calendarSchema } from '../schemas/common.schema.js';

const calendarRoutes = Router();

calendarRoutes.get('/', validateSchema(calendarSchema), new GetCalendarController().handle);

export default calendarRoutes;
