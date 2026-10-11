export class AppError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details?: unknown,
    ) {
        super(message);
    }
}

export function notFound(): never {
    throw new AppError(404, 'NOT_FOUND', 'Registro não encontrado.');
}
