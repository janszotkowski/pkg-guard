import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

/**
 * The schema, in order. A step is applied once and recorded in `user_version`, so a new step is appended and never
 * edited: a database created by an older build is brought up to date at start-up.
 *
 * `analyses` is both the store of results and the queue: a row is one package version measured one way, so asking twice
 * for what is already waiting adds nothing.
 */
export const MIGRATIONS: readonly string[] = [
    `
    CREATE TABLE analyses (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        analyzer_version INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed')),
        result TEXT,
        failure_code TEXT,
        failure_message TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        -- While running: when the job is taken away from a worker that said nothing (milliseconds since the epoch).
        lease_until INTEGER,
        requested_at INTEGER NOT NULL,
        finished_at INTEGER,
        UNIQUE (name, version, analyzer_version)
    );
    CREATE INDEX analyses_queue ON analyses (status, requested_at);
    `,
    // The part-by-part numbers arrive after the result. `exports_until` is when a worker that said nothing is given up on.
    `
    ALTER TABLE analyses ADD COLUMN exports TEXT;
    ALTER TABLE analyses ADD COLUMN exports_status TEXT CHECK (exports_status IN ('pending', 'done', 'unavailable'));
    ALTER TABLE analyses ADD COLUMN exports_until INTEGER;
    `,
    // 0 is someone waiting for this package; 1 is an older version measured on request, after anything that is waited for.
    `
    ALTER TABLE analyses ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
    DROP INDEX analyses_queue;
    CREATE INDEX analyses_queue ON analyses (status, priority, requested_at);
    `,
];

export const openDatabase = (path: string): Database => {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
    for (const [index, step] of MIGRATIONS.entries()) {
        if (index < row.user_version) continue;
        db.exec('BEGIN');
        try {
            db.exec(step);
            db.exec(`PRAGMA user_version = ${index + 1}`);
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }
    return db;
};
