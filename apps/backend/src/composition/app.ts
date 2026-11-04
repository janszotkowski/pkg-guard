import type { Hono } from 'hono';
import type { Config } from '@config/env.ts';
import { analysisRoutes, workerRoutes } from '@modules/analyses/http/routes.ts';
import type { DownloadsReader, PackageSearcher, StarsReader, VersionLister, VersionResolver } from '@modules/analyses/infrastructure/registry.ts';
import type { AnalysisStore } from '@modules/analyses/infrastructure/store.ts';
import { createBaseApp, type AppEnv } from '@platform/http/app.ts';
import type { Logger } from '@platform/logger.ts';

/** `resolve`, `search`, `listVersions`, `readDownloads` and `readStars` are npm and GitHub in production; tests pass their own, so they never reach the network. */
export type Container = {
    config: Config;
    logger: Logger;
    store: AnalysisStore;
    resolve: VersionResolver;
    search: PackageSearcher;
    listVersions: VersionLister;
    readDownloads: DownloadsReader;
    readStars: StarsReader;
};

/** The whole API: the HTTP shell with the public routes under `/v1` and the worker's under `/internal`. */
export const createApp = (container: Container): Hono<AppEnv> => {
    const app = createBaseApp(container);
    app.get('/v1/health', (c) => {
        c.header('cache-control', 'no-store');
        return c.json({ status: 'ok' as const, version: container.config.APP_VERSION });
    });
    app.route('/v1', analysisRoutes(container.store, container.resolve, container.search, container.listVersions, container.readDownloads, container.readStars));
    app.route('/internal', workerRoutes(container.store, container.config.WORKER_TOKEN));
    return app;
};
