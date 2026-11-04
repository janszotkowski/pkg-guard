import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { PackageRef } from '@pkg-guard/core';
import type { Config } from '@config/env.ts';
import type { AnalyzeOutcome, AnalyzeRequest } from './protocol.ts';

/**
 * Only what running pnpm needs. Above all not `WORKER_TOKEN`: the process that handles a package has no secret to lose.
 * PNPM_HOME and COREPACK_HOME are where the pnpm command itself may live.
 */
const PASSED_ENV = ['PATH', 'HOME', 'LANG', 'TMPDIR', 'PNPM_HOME', 'COREPACK_HOME'] as const;

const analysisEnv = (): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    for (const name of PASSED_ENV) {
        const value = process.env[name];
        if (value !== undefined) env[name] = value;
    }
    return env;
};

/**
 * One analysis in a process of its own, in its own process group, so that a package that hangs the bundler, or a pnpm
 * below it, can be killed whole. Its folder is removed whatever happened.
 */
export const runAnalysis = async (ref: PackageRef, config: Pick<Config, 'WORKER_DIR' | 'JOB_TIMEOUT_MS' | 'MAX_INSTALL_BYTES'>): Promise<AnalyzeOutcome> => {
    const dir = join(config.WORKER_DIR, 'jobs', randomUUID());
    const request: AnalyzeRequest = { package: ref, options: { dir, storeDir: join(config.WORKER_DIR, 'store'), maxInstallBytes: config.MAX_INSTALL_BYTES } };
    try {
        return await new Promise<AnalyzeOutcome>((resolve) => {
            const child = fork(new URL('./main.analyze.mjs', import.meta.url), { env: analysisEnv(), detached: true, execArgv: ['--max-old-space-size=2048'] });
            let settled = false;
            const settle = (outcome: AnalyzeOutcome): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(outcome);
            };
            const killGroup = (): void => {
                if (child.pid === undefined) return;
                try {
                    process.kill(-child.pid, 'SIGKILL');
                } catch {
                    // The group is already gone.
                }
            };
            const timer = setTimeout(() => {
                killGroup();
                settle({ ok: false, failure: { code: 'TIMEOUT', message: `The analysis took longer than ${config.JOB_TIMEOUT_MS} ms` } });
            }, config.JOB_TIMEOUT_MS);

            child.once('message', (message) => {
                settle(message as AnalyzeOutcome);
            });
            child.once('error', (error) => settle({ ok: false, failure: { code: 'INTERNAL', message: error.message } }));
            child.once('exit', (code, signal) => settle({ ok: false, failure: { code: 'INTERNAL', message: `The analysis process ended early (${signal ?? code})` } }));
            child.send(request);
        });
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
};
