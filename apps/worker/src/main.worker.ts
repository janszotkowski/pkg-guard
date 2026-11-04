import { setTimeout as sleep } from 'node:timers/promises';
import { pino } from 'pino';
import { loadConfig } from '@config/env.ts';
import { runAnalysis } from '@modules/analysis/runner.ts';
import { createBackendClient } from '@modules/backend/client.ts';

const loaded = loadConfig();
if (!loaded.ok) {
    process.stderr.write(`Invalid configuration:\n${loaded.problems.map((problem) => `  - ${problem}`).join('\n')}\n`);
    process.exit(1);
}
const config = loaded.config;
const logger = pino({ level: config.LOG_LEVEL, base: { service: 'worker' }, messageKey: 'msg', timestamp: pino.stdTimeFunctions.isoTime, formatters: { level: (label) => ({ level: label }) } });
const backend = createBackendClient(config);

const stop = new AbortController();

/** It only ever handles what the backend's queue holds, and that holds only what someone asked for: nothing is fetched on its own. */
const slot = async (index: number): Promise<void> => {
    while (!stop.signal.aborted) {
        let waitForWork = false;
        try {
            const job = await backend.claim();
            if (job === undefined) {
                waitForWork = true;
            } else {
                const started = performance.now();
                const outcome = await runAnalysis(job.package, config);
                const ms = Math.round(performance.now() - started);
                if (outcome.ok) {
                    await backend.complete(job.id, outcome.result);
                    logger.info({ package: job.package, ms, sizes: outcome.result.sizes }, 'analyzed');
                } else {
                    await backend.fail(job.id, outcome.failure);
                    logger.warn({ package: job.package, ms, failure: outcome.failure }, 'analysis failed');
                }
            }
        } catch (error) {
            // The backend may simply not be up yet: try again in a while.
            logger.warn({ slot: index, err: error }, 'worker loop');
            waitForWork = true;
        }
        if (waitForWork) await sleep(config.WORKER_POLL_MS, undefined, { signal: stop.signal }).catch(() => undefined);
    }
};

const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    stop.abort();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info({ backend: config.BACKEND_URL, dir: config.WORKER_DIR, concurrency: config.WORKER_CONCURRENCY }, 'worker started');
await Promise.all(Array.from({ length: config.WORKER_CONCURRENCY }, (_, index) => slot(index)));
process.exit(0);
