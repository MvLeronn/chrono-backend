import type { Request, Response } from 'express';
import { userId } from '../../middlewares/validate-schema.js';
import { GetCurrentUserService } from '../../services/auth/get-current-user.service.js';

export class GetCurrentUserController {
    async handle(req: Request, res: Response) {
        const service = new GetCurrentUserService();
        return res.json(await service.execute(userId(req)));
    }
}
