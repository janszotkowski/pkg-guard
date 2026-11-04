import { claimResponseSchema, isExactVersion, isValidPackageName, type AnalysisFailure, type AnalysisResult, type Job } from '@pkg-guard/core';
import type { Config } from '@config/env.ts';

const TIMEOUT_MS = 10_000;

/** The worker's only way to the data: it holds no database of its own. */
export const createBackendClient = (config: Pick<Config, 'BACKEND_URL' | 'WORKER_TOKEN'>) => {
    const post = async (path: string, body?: unknown): Promise<unknown> => {
        const response = await fetch(new URL(path, config.BACKEND_URL), {
            method: 'POST',
            headers: { authorization: `Bearer ${config.WORKER_TOKEN}`, 'content-type': 'application/json' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (!response.ok) throw new Error(`The backend answered ${response.status} to ${path}`);
        return response.json();
    };

    return {
        claim: async (): Promise<Job | undefined> => {
            const { job } = claimResponseSchema.parse(await post('/internal/jobs/claim'));
            if (job === null) return undefined;
            // The name becomes a path and a dependency here: not taken on trust, whoever sent it.
            if (!isValidPackageName(job.package.name) || !isExactVersion(job.package.version)) throw new Error(`The backend sent an invalid package (job ${job.id})`);
            return job;
        },
        complete: async (id: number, result: AnalysisResult): Promise<void> => {
            await post(`/internal/jobs/${id}/result`, result);
        },
        fail: async (id: number, failure: AnalysisFailure): Promise<void> => {
            await post(`/internal/jobs/${id}/failure`, failure);
        },
    };
};

export type BackendClient = ReturnType<typeof createBackendClient>;
