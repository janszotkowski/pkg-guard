import { createHash, timingSafeEqual } from 'node:crypto';
import { analysisFailureSchema, analysisResultSchema, isExactVersion, parseSpec } from '@pkg-guard/core';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { VersionResolver } from '@modules/analyses/infrastructure/registry.ts';
import type { AnalysisStore } from '@modules/analyses/infrastructure/store.ts';
import { AppError } from '@platform/errors.ts';
import type { AppEnv } from '@platform/http/app.ts';

const DAY_SECONDS = 86_400;
const TAG_SECONDS = 300;

/** The public API: what a package costs. */
export const analysisRoutes = (store: AnalysisStore, resolve: VersionResolver): Hono<AppEnv> => {
    const routes = new Hono<AppEnv>();

    routes.get('/analyses', async (c) => {
        const spec = parseSpec(c.req.query('package') ?? '');
        if (spec === undefined) throw new AppError('VALIDATION_FAILED', 'package must be a name with an optional exact version or dist-tag, such as react or react@19.1.0');

        const exact = spec.version !== undefined && isExactVersion(spec.version);
        // An exact version already in the store needs no question to the registry: polling costs it nothing.
        const known = exact ? store.find({ name: spec.name, version: spec.version as string }) : undefined;
        const answer = known?.status === 'failed' || known === undefined ? store.findOrEnqueue({ name: spec.name, version: await resolve(spec.name, spec.version ?? 'latest') }) : known;

        // A finished result of an exact version does not change until the analyzer does; what a tag points to does.
        c.header('cache-control', answer.status !== 'done' ? 'no-store' : `public, max-age=${exact ? DAY_SECONDS : TAG_SECONDS}`);
        return c.json(answer);
    });

    return routes;
};

/** Compares secrets in constant time; hashing first makes the lengths equal, which `timingSafeEqual` requires. */
const sameSecret = (given: string, expected: string): boolean => timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());

const jobId = (value: string): number => {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError('VALIDATION_FAILED', 'id must be a positive whole number');
    return id;
};

/** What only the worker calls: take a job, hand in its result. Never reachable from a browser (no CORS) or without the token. */
export const workerRoutes = (store: AnalysisStore, workerToken: string): Hono<AppEnv> => {
    const routes = new Hono<AppEnv>();

    routes.use(async (c, next) => {
        const token = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1];
        if (token === undefined || !sameSecret(token, workerToken)) throw new AppError('UNAUTHORIZED', 'A valid worker token is required');
        await next();
    });
    routes.use(bodyLimit({ maxSize: 64 * 1024 }));

    routes.post('/jobs/claim', (c) => c.json({ job: store.claim() ?? null }));

    routes.post('/jobs/:id/result', async (c) => {
        const result = analysisResultSchema.safeParse(await c.req.json());
        if (!result.success) throw new AppError('VALIDATION_FAILED', 'The result does not match the contract');
        return c.json({ accepted: store.complete(jobId(c.req.param('id')), result.data) });
    });

    routes.post('/jobs/:id/failure', async (c) => {
        const failure = analysisFailureSchema.safeParse(await c.req.json());
        if (!failure.success) throw new AppError('VALIDATION_FAILED', 'The failure does not match the contract');
        return c.json({ accepted: store.fail(jobId(c.req.param('id')), failure.data) });
    });

    return routes;
};
