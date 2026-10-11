import type { Request, Response } from 'express';
import { loginSchema } from '../../schemas/auth.schema.js';
import { validated } from '../../middlewares/validate-schema.js';
import { LoginService } from '../../services/auth/login.service.js';

export class LoginController {
    async handle(req: Request, res: Response) {
        const service = new LoginService();
        const { body } = validated(req, loginSchema);
        return res.json(await service.execute(body.password));
    }
}
