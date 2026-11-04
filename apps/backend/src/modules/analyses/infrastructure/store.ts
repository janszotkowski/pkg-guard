import { ANALYZER_VERSION, analysisResponseSchema, analysisResultSchema, type AnalysisFailure, type AnalysisResponse, type AnalysisResult, type Job, type PackageRef } from '@pkg-guard/core';
import { AppError } from '@platform/errors.ts';
import type { Database } from './database.ts';

type Row = {
    id: number;
    name: string;
    version: string;
    status: string;
    result: string | null;
    failure_code: string | null;
    failure_message: string | null;
    finished_at: number | null;
};

export type StoreOptions = { maxWaiting: number; leaseMs: number; maxAttempts: number; failedRetryMs: number; now?: () => number };

const toResponse = (row: Row): AnalysisResponse =>
    analysisResponseSchema.parse({
        package: { name: row.name, version: row.version },
        analyzerVersion: ANALYZER_VERSION,
        status: row.status,
        ...(row.result === null ? {} : { result: analysisResultSchema.parse(JSON.parse(row.result)) }),
        ...(row.failure_code === null ? {} : { failure: { code: row.failure_code, message: row.failure_message ?? '' } }),
    });

export const createAnalysisStore = (db: Database, options: StoreOptions) => {
    const now = options.now ?? Date.now;

    const select = db.prepare('SELECT * FROM analyses WHERE name = ? AND version = ? AND analyzer_version = ?');
    const waiting = db.prepare("SELECT count(*) AS waiting FROM analyses WHERE status = 'queued'");
    const insert = db.prepare("INSERT INTO analyses (name, version, analyzer_version, status, requested_at) VALUES (?, ?, ?, 'queued', ?) RETURNING *");
    const requeue = db.prepare("UPDATE analyses SET status = 'queued', failure_code = NULL, failure_message = NULL, attempts = 0, finished_at = NULL, requested_at = ? WHERE id = ? RETURNING *");
    const giveUp = db.prepare(
        "UPDATE analyses SET status = 'failed', failure_code = 'TIMEOUT', failure_message = 'The analysis did not finish', lease_until = NULL, finished_at = ? WHERE status = 'running' AND lease_until < ? AND attempts >= ?",
    );
    const expire = db.prepare("UPDATE analyses SET status = 'queued', lease_until = NULL WHERE status = 'running' AND lease_until < ? AND attempts < ?");
    const claimNext = db.prepare(
        `UPDATE analyses SET status = 'running', attempts = attempts + 1, lease_until = ?
         WHERE id = (SELECT id FROM analyses WHERE status = 'queued' AND analyzer_version = ? ORDER BY requested_at, id LIMIT 1)
         RETURNING id, name, version`,
    );
    const finish = db.prepare("UPDATE analyses SET status = 'done', result = ?, lease_until = NULL, finished_at = ? WHERE id = ? AND status = 'running'");
    const failJob = db.prepare("UPDATE analyses SET status = 'failed', failure_code = ?, failure_message = ?, lease_until = NULL, finished_at = ? WHERE id = ? AND status = 'running'");

    const assertRoom = (): void => {
        const { waiting: count } = waiting.get() as { waiting: number };
        if (count >= options.maxWaiting) throw new AppError('UNAVAILABLE', 'Too many packages are waiting to be analyzed; try again in a moment');
    };

    return {
        /** What is known of a package, without asking for anything. */
        find: (ref: PackageRef): AnalysisResponse | undefined => {
            const row = select.get(ref.name, ref.version, ANALYZER_VERSION) as Row | undefined;
            return row === undefined ? undefined : toResponse(row);
        },

        /** What is known of a package, queueing it when nothing is, or when its last failure is old enough to try again. */
        findOrEnqueue: (ref: PackageRef): AnalysisResponse => {
            const row = select.get(ref.name, ref.version, ANALYZER_VERSION) as Row | undefined;
            if (row === undefined) {
                assertRoom();
                return toResponse(insert.get(ref.name, ref.version, ANALYZER_VERSION, now()) as Row);
            }
            if (row.status === 'failed' && now() - (row.finished_at ?? 0) >= options.failedRetryMs) {
                assertRoom();
                return toResponse(requeue.get(now(), row.id) as Row);
            }
            return toResponse(row);
        },

        /** The oldest waiting package, for one worker. A job whose worker went silent goes back in line first, or fails when it has had its tries. */
        claim: (): Job | undefined => {
            const at = now();
            giveUp.run(at, at, options.maxAttempts);
            expire.run(at, options.maxAttempts);
            const row = claimNext.get(at + options.leaseMs, ANALYZER_VERSION) as Pick<Row, 'id' | 'name' | 'version'> | undefined;
            return row === undefined ? undefined : { id: row.id, package: { name: row.name, version: row.version } };
        },

        /** False when the job is no longer running (its lease ran out): the late answer is dropped. */
        complete: (id: number, result: AnalysisResult): boolean => Number(finish.run(JSON.stringify(result), now(), id).changes) > 0,

        fail: (id: number, failure: AnalysisFailure): boolean => Number(failJob.run(failure.code, failure.message, now(), id).changes) > 0,
    };
};

export type AnalysisStore = ReturnType<typeof createAnalysisStore>;
