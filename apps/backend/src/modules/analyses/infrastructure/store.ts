import {
    ANALYZER_VERSION,
    analysisResponseSchema,
    analysisResultSchema,
    exportDetailsSchema,
    type AnalysisFailure,
    type AnalysisResponse,
    type AnalysisResult,
    type ExportDetails,
    type ExportsState,
    type Job,
    type PackageRef,
} from '@pkg-guard/core';
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
    exports: string | null;
    exports_status: string | null;
    exports_until: number | null;
};

export type StoreOptions = { maxWaiting: number; leaseMs: number; maxAttempts: number; failedRetryMs: number; now?: () => number };

/** A worker that went silent after the main result never sends the rest: past its time, the page stops waiting. */
const exportsState = (row: Row, at: number): ExportsState => {
    if (row.exports_status === 'done' && row.exports !== null) return { status: 'done', details: exportDetailsSchema.parse(JSON.parse(row.exports)) };
    if (row.exports_status === 'pending' && at < (row.exports_until ?? 0)) return { status: 'pending' };
    return { status: 'unavailable' };
};

export const createAnalysisStore = (db: Database, options: StoreOptions) => {
    const now = options.now ?? Date.now;

    const toResponse = (row: Row): AnalysisResponse =>
        analysisResponseSchema.parse({
            package: { name: row.name, version: row.version },
            analyzerVersion: ANALYZER_VERSION,
            status: row.status,
            ...(row.result === null ? {} : { result: analysisResultSchema.parse(JSON.parse(row.result)), exports: exportsState(row, now()) }),
            ...(row.failure_code === null ? {} : { failure: { code: row.failure_code, message: row.failure_message ?? '' } }),
        });

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
    const finish = db.prepare(
        "UPDATE analyses SET status = 'done', result = ?, exports_status = 'pending', exports_until = ?, lease_until = NULL, finished_at = ? WHERE id = ? AND status = 'running'",
    );
    const failJob = db.prepare("UPDATE analyses SET status = 'failed', failure_code = ?, failure_message = ?, lease_until = NULL, finished_at = ? WHERE id = ? AND status = 'running'");
    const finishExports = db.prepare("UPDATE analyses SET exports = ?, exports_status = 'done', exports_until = NULL WHERE id = ? AND exports_status = 'pending'");
    const failExports = db.prepare("UPDATE analyses SET exports_status = 'unavailable', exports_until = NULL WHERE id = ? AND exports_status = 'pending'");

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

        /** False when the job is no longer running (its lease ran out): the late answer is dropped. The part-by-part numbers are now awaited. */
        complete: (id: number, result: AnalysisResult): boolean => {
            const at = now();
            return Number(finish.run(JSON.stringify(result), at + options.leaseMs, at, id).changes) > 0;
        },

        fail: (id: number, failure: AnalysisFailure): boolean => Number(failJob.run(failure.code, failure.message, now(), id).changes) > 0,

        completeExports: (id: number, details: ExportDetails): boolean => Number(finishExports.run(JSON.stringify(details), id).changes) > 0,

        /** The main result stands: only the part-by-part numbers are given up on. */
        failExports: (id: number): boolean => Number(failExports.run(id).changes) > 0,
    };
};

export type AnalysisStore = ReturnType<typeof createAnalysisStore>;
