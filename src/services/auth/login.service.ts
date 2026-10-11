import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../prisma/index.js';
import { env } from '../../config/env.js';
import { AppError } from '../../domain/errors.js';

const dummyHash = bcrypt.hash('chrono-unconfigured-owner', 12);

export class LoginService {
    async execute(password: string) {
        const user = await prisma.user.findUnique({ where: { singletonKey: 1 } });
        const matches = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
        if (!user || !matches) throw new AppError(401, 'INVALID_CREDENTIALS', 'Senha inválida.');
        const token = jwt.sign({ version: user.tokenVersion }, env.JWT_SECRET, {
            algorithm: 'HS256',
            subject: user.id,
            expiresIn: env.JWT_EXPIRES_IN_SECONDS,
            issuer: 'chrono',
            audience: 'chrono-api',
        });
        return {
            token,
            tokenType: 'Bearer',
            expiresIn: env.JWT_EXPIRES_IN_SECONDS,
            user: { id: user.id, timezone: user.timezone },
        };
    }
}
