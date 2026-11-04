import { serve } from '@hono/node-server';
import { createApp } from '@composition/app.ts';
import { loadConfig } from '@config/env.ts';
import { openDatabase } from '@modules/analyses/infrastructure/database.ts';
import { resolveFromRegistry, searchRegistry } from '@modules/analyses/infrastructure/registry.ts';
import { createAnalysisStore } from '@modules/analyses/infrastructure/store.ts';
import { createLogger } from '@platform/logger.ts';

const loaded = loadConfig();
if (!loaded.ok) {
    process.stderr.write(`Invalid configuration:\n${loaded.problems.map((problem) => `  - ${problem}`).join('\n')}\n`);
    process.exit(1);
}
const config = loaded.config;
const logger = createLogger(config);

process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled rejection');
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    process.exit(1);
});

const db = openDatabase(config.DATABASE_PATH);
const store = createAnalysisStore(db, {
    maxWaiting: config.QUEUE_MAX_WAITING,
    leaseMs: config.JOB_LEASE_SECONDS * 1000,
    maxAttempts: config.JOB_MAX_ATTEMPTS,
    failedRetryMs: config.JOB_FAILED_RETRY_MINUTES * 60_000,
});

const server = serve({ fetch: createApp({ config, logger, store, resolve: resolveFromRegistry, search: searchRegistry }).fetch, port: config.PORT, hostname: config.HOST }, (address) => {
    logger.info({ port: address.port, host: config.HOST, database: config.DATABASE_PATH }, 'api listening');
});

let stopping = false;
const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => {
        logger.error('shutdown timed out');
        process.exit(1);
    }, 10_000);
    force.unref();
    server.close(() => {
        db.close();
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
