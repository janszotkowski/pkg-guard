import { createHash, timingSafeEqual } from 'node:crypto';
import {
    MAX_SEARCH_LENGTH,
    MIN_SEARCH_LENGTH,
    analysisFailureSchema,
    analysisResultSchema,
    exportDetailsSchema,
    TREND_RANGES,
    isExactVersion,
    parseSpec,
    type AnalysisResponse,
    type HistoryResponse,
    type VersionEntry,
} from '@pkg-guard/core';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { DownloadsReader, PackageSearcher, ReleasedVersion, StarsReader, VersionLister, VersionResolver } from '@modules/analyses/infrastructure/registry.ts';
import type { AnalysisStore } from '@modules/analyses/infrastructure/store.ts';
import { AppError } from '@platform/errors.ts';
import type { AppEnv } from '@platform/http/app.ts';

const DAY_SECONDS = 86_400;
const TAG_SECONDS = 300;
const SEARCH_SECONDS = 300;

/** Anything still changing is asked for again, so it must not be kept. */
const isSettled = (answer: AnalysisResponse): boolean => answer.status === 'done' && answer.exports.status !== 'pending';

const REPOSITORY = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;
const DOWNLOADS_SECONDS = 3600;

const versionEntry = (released: ReleasedVersion, known: AnalysisResponse | undefined): VersionEntry => {
    const { version, publishedAt } = released;
    if (known === undefined) return { version, publishedAt, status: 'unmeasured', gzip: null, minified: null };
    const sizes = known.status === 'done' ? known.result.sizes : null;
    return { version, publishedAt, status: known.status, gzip: sizes?.gzip ?? null, minified: sizes?.minified ?? null };
};

/** The public API: what a package costs. */
export const analysisRoutes = (
    store: AnalysisStore,
    resolve: VersionResolver,
    search: PackageSearcher,
    listVersions: VersionLister,
    readDownloads: DownloadsReader,
    readStars: StarsReader,
): Hono<AppEnv> => {
    const routes = new Hono<AppEnv>();

    const packageName = (value: string | undefined): string => {
        const spec = parseSpec(value ?? '');
        if (spec === undefined || spec.version !== undefined) throw new AppError('VALIDATION_FAILED', 'package must be a name without a version');
        return spec.name;
    };

    const history = async (name: string): Promise<HistoryResponse> => ({
        name,
        versions: (await listVersions(name)).map((released) => versionEntry(released, store.find({ name, version: released.version }))),
    });

    routes.get('/history', async (c) => {
        c.header('cache-control', 'no-store');
        return c.json(await history(packageName(c.req.query('package'))));
    });

    // Measuring downloads every version, so it is only ever asked for, never done because a page was opened.
    routes.post('/history', async (c) => {
        const name = packageName(c.req.query('package'));
        for (const { version } of await listVersions(name)) store.enqueueLater({ name, version });
        c.header('cache-control', 'no-store');
        return c.json(await history(name));
    });

    routes.get('/analyses', async (c) => {
        const spec = parseSpec(c.req.query('package') ?? '');
        if (spec === undefined) throw new AppError('VALIDATION_FAILED', 'package must be a name with an optional exact version or dist-tag, such as react or react@19.1.0');

        const exact = spec.version !== undefined && isExactVersion(spec.version);
        // An exact version already in the store needs no question to the registry: polling costs it nothing.
        const known = exact ? store.find({ name: spec.name, version: spec.version as string }) : undefined;
        const answer = known?.status === 'failed' || known === undefined ? store.findOrEnqueue({ name: spec.name, version: await resolve(spec.name, spec.version ?? 'latest') }) : known;

        // A finished result of an exact version does not change until the analyzer does; what a tag points to does.
        c.header('cache-control', isSettled(answer) ? `public, max-age=${exact ? DAY_SECONDS : TAG_SECONDS}` : 'no-store');
        return c.json(answer);
    });

    routes.get('/downloads', async (c) => {
        const name = packageName(c.req.query('package'));
        const range = TREND_RANGES.find((candidate) => candidate === c.req.query('range'));
        if (range === undefined) throw new AppError('VALIDATION_FAILED', `range must be one of ${TREND_RANGES.join(', ')}`);
        c.header('cache-control', `public, max-age=${DOWNLOADS_SECONDS}`);
        return c.json({ name, days: await readDownloads(name, range) });
    });

    routes.get('/stars', async (c) => {
        const repository = c.req.query('repository') ?? '';
        if (!REPOSITORY.test(repository) || repository.split('/').some((part) => part.startsWith('.'))) throw new AppError('VALIDATION_FAILED', 'repository must be owner/name');
        c.header('cache-control', `public, max-age=${DOWNLOADS_SECONDS}`);
        return c.json({ stars: await readStars(repository) });
    });

    routes.get('/search', async (c) => {
        const query = (c.req.query('q') ?? '').trim();
        if (query.length < MIN_SEARCH_LENGTH || query.length > MAX_SEARCH_LENGTH) throw new AppError('VALIDATION_FAILED', `q must be ${MIN_SEARCH_LENGTH} to ${MAX_SEARCH_LENGTH} characters`);
        c.header('cache-control', `public, max-age=${SEARCH_SECONDS}`);
        return c.json({ packages: await search(query) });
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
    // The largest body is a package's list of exports, with a name and two sizes for each.
    routes.use(bodyLimit({ maxSize: 512 * 1024 }));

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

    routes.post('/jobs/:id/exports', async (c) => {
        const details = exportDetailsSchema.safeParse(await c.req.json());
        if (!details.success) throw new AppError('VALIDATION_FAILED', 'The export details do not match the contract');
        return c.json({ accepted: store.completeExports(jobId(c.req.param('id')), details.data) });
    });

    routes.post('/jobs/:id/exports-failure', (c) => c.json({ accepted: store.failExports(jobId(c.req.param('id'))) }));

    return routes;
};
