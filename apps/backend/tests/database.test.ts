import { describe, expect, it } from 'vitest';
import { MIGRATIONS, openDatabase, optimize } from '@modules/analyses/infrastructure/database.ts';

describe('the database', () => {
    it('opens with every migration applied and the pragmas set', () => {
        const db = openDatabase(':memory:');
        expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(MIGRATIONS.length);
        expect((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys).toBe(1);
        expect((db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout).toBe(5000);
        db.close();
    });

    it('analyzes a database that never was, and is cheap to call again', () => {
        const db = openDatabase(':memory:');
        db.prepare("INSERT INTO analyses (name, version, analyzer_version, status, requested_at) VALUES ('example', '1.0.0', 1, 'queued', 0)").run();
        const stats = () => (db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'sqlite_stat1'").get() as { n: number }).n;
        expect(Number(stats())).toBe(0);
        optimize(db);
        expect(Number(stats())).toBe(1);
        expect(() => optimize(db)).not.toThrow();
        db.close();
    });
});
