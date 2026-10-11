import type { RequestHandler, Request } from 'express';
import type { z } from 'zod';

export function validateSchema(schema: z.ZodType): RequestHandler {
    return async (req, _res, next) => {
        req.validated = (await schema.parseAsync({
            body: req.body ?? {},
            params: req.params,
            query: req.query,
        })) as NonNullable<Request['validated']>;
        next();
    };
}

export function validated<T extends z.ZodType>(req: Request, _schema: T): z.infer<T> {
    return req.validated as z.infer<T>;
}

export function userId(req: Request): string {
    if (!req.userId) throw new Error('Authentication middleware is required.');
    return req.userId;
}
