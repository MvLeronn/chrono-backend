import { Router } from 'express';
import { LoginController } from '../controllers/auth/login.controller.js';
import { validateSchema } from '../middlewares/validate-schema.js';
import { loginSchema } from '../schemas/auth.schema.js';
import { GetCurrentUserController } from '../controllers/auth/get-current-user.controller.js';
import { isAuthenticated } from '../middlewares/is-authenticated.js';

const authRoutes = Router();

authRoutes.post('/login', validateSchema(loginSchema), new LoginController().handle);

authRoutes.get('/me', isAuthenticated, new GetCurrentUserController().handle);

export default authRoutes;
