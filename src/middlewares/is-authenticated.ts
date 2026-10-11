import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import prisma from '../prisma/index.js';
import { AppError } from '../domain/errors.js';

export const isAuthenticated: RequestHandler = async (req, _res, next) => {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    const unauthorized = () =>
        new AppError(401, 'UNAUTHORIZED', 'Sessão ausente, inválida ou expirada.');
    if (!match?.[1]) throw unauthorized();
    let payload: jwt.JwtPayload;
    try {
        const result = jwt.verify(match[1], env.JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'chrono',
            audience: 'chrono-api',
        });
        if (typeof result === 'string' || !result.sub || typeof result.version !== 'number')
            throw unauthorized();
        payload = result;
    } catch {
        throw unauthorized();
    }
    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.version) throw unauthorized();
    req.userId = user.id;
    next();
};
