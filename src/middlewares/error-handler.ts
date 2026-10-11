import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../domain/errors.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) {
        res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: error.issues },
        });
    } else if (error instanceof AppError) {
        res.status(error.status).json({
            error: { code: error.code, message: error.message, details: error.details },
        });
    } else if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2003', 'P2025', 'P2034'].includes(error.code)
    ) {
        res.status(error.code === 'P2025' ? 404 : 409).json({
            error: {
                code: 'DATA_CONFLICT',
                message:
                    'Registro indisponível ou conflito com outra alteração. Atualize e tente novamente.',
            },
        });
    } else if (error instanceof SyntaxError && 'body' in error) {
        res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido.' } });
    } else if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        error.type === 'entity.too.large'
    ) {
        res.status(413).json({
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisição muito grande.' },
        });
    } else {
        console.error(
            'Unhandled request error:',
            error instanceof Error ? error.name : 'UnknownError',
        );
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação.' },
        });
    }
};
