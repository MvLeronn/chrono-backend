import type { Request, Response } from 'express';
import { calendarSchema } from '../../schemas/common.schema.js';
import { userId, validated } from '../../middlewares/validate-schema.js';
import { GetCalendarService } from '../../services/calendar/get-calendar.service.js';

export class GetCalendarController {
    async handle(req: Request, res: Response) {
        const service = new GetCalendarService();
        const { query } = validated(req, calendarSchema);
        return res.json(await service.execute(userId(req), query.from, query.to));
    }
}
