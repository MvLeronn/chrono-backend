import { Router } from 'express';
import authRoutes from './auth-routes.js';
import eventRoutes from './event-routes.js';
import templateRoutes from './week-template-routes.js';
import recurringRoutes from './recurring-event-routes.js';
import occurrenceRoutes from './recurring-occurrence-routes.js';
import calendarRoutes from './calendar-routes.js';
import { isAuthenticated } from '../middlewares/is-authenticated.js';
const router = Router();
router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
router.use('/auth', authRoutes);
router.use(isAuthenticated);
router.use('/calendar', calendarRoutes);
router.use('/events', eventRoutes);
router.use('/week-templates', templateRoutes);
router.use('/recurring-events', recurringRoutes);
router.use('/recurring-events', occurrenceRoutes);

export default router;
