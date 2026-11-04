import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { Config } from '@config/env.ts';
import { AppError, errorBody, statusOf } from '@platform/errors.ts';
import type { Logger } from '@platform/logger.ts';

export type AppEnv = { Variables: { requestId: string; logger: Logger } };

const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** A frontend on this machine, on whatever port the dev server picked. */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** The origins named in the configuration; with none named (development only, production requires them), any local one. */
export const allowedOrigin = (configured: readonly string[], origin: string): string | undefined => {
    if (configured.length > 0) return configured.includes(origin) ? origin : undefined;
    return LOCAL_ORIGIN.test(origin) ? origin : undefined;
};

/** The HTTP shell every module plugs into: request id, access log, CORS, security headers and one place that turns failures into the error contract. */
export const createBaseApp = (deps: { config: Config; logger: Logger }): Hono<AppEnv> => {
    const app = new Hono<AppEnv>();

    app.use(async (c, next) => {
        // A caller-supplied id is accepted only in a safe shape: it ends up in logs.
        const incoming = c.req.header('x-request-id');
        const requestId = incoming !== undefined && REQUEST_ID.test(incoming) ? incoming : randomUUID();
        c.set('requestId', requestId);
        c.set('logger', deps.logger.child({ requestId }));
        const started = performance.now();
        await next();
        c.header('x-request-id', requestId);
        // The worker asks for work every second: at `info` that would bury every other line. What it handles, it logs itself.
        const level = c.req.path === '/internal/jobs/claim' && c.res.ok ? 'debug' : 'info';
        c.var.logger[level]({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - started) }, 'request');
    });
    app.use('/v1/*', cors({ origin: (origin) => allowedOrigin(deps.config.CORS_ORIGINS, origin), allowMethods: ['GET', 'HEAD', 'POST', 'OPTIONS'], maxAge: 86_400 }));
    app.use(secureHeaders());

    app.notFound((c) => c.json(errorBody('NOT_FOUND', 'There is nothing at this address', c.get('requestId')), 404));
    app.onError((error, c) => {
        const requestId = c.get('requestId');
        if (error instanceof AppError) return c.json(errorBody(error.code, error.message, requestId), statusOf(error.code));
        if (error instanceof HTTPException && error.status < 500) return c.json(errorBody('VALIDATION_FAILED', error.message, requestId), 400);
        deps.logger.error({ err: error, requestId }, 'unhandled error');
        return c.json(errorBody('INTERNAL', 'Something went wrong', requestId), 500);
    });

    return app;
};
