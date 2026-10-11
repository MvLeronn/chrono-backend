import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { env } from './config/env.js';
import prisma from './prisma/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { AppError } from './domain/errors.js';

export function createApp() {
    const app = express();
    const origins = env.CORS_ORIGINS.split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin || origins.includes(origin)) callback(null, true);
                else callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não permitida.'));
            },
        }),
    );
    app.use(express.json());

    app.use(routes);
    app.use((_req, res) => {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
    });
    app.use(errorHandler);

    return app;
}

async function startServer() {
    await prisma.$connect();
    const server = createApp().listen(env.PORT, env.HOST, () => {
        console.info(`Chrono API disponível em http://${env.HOST}:${env.PORT}`);
    });

    let stopping = false;
    function shutdown() {
        if (stopping) return;
        stopping = true;
        const timeout = setTimeout(() => process.exit(1), 10_000).unref();
        server.close(() => {
            void prisma.$disconnect().finally(() => {
                clearTimeout(timeout);
                process.exit(0);
            });
        });
    }

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

// Importing createApp for tests does not start a listener or register signal handlers.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await startServer();
}
