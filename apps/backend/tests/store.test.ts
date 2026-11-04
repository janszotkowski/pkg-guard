import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '@pkg-guard/core';
import { openDatabase } from '@modules/analyses/infrastructure/database.ts';
import { createAnalysisStore } from '@modules/analyses/infrastructure/store.ts';

const RESULT: AnalysisResult = {
    bundler: { name: 'rolldown', version: '1.0.0' },
    entry: 'export-star',
    sizes: { minified: 300, gzip: 200, brotli: 100 },
    install: { bytes: 1000, packages: 1 },
    peerDependencies: [],
    timingsMs: { install: 1, bundle: 1, compress: 1 },
};

const REF = { name: 'example', version: '1.0.0' };

const setup = (maxWaiting = 10) => {
    const clock = { now: 1000 };
    const store = createAnalysisStore(openDatabase(':memory:'), { maxWaiting, leaseMs: 100, maxAttempts: 2, failedRetryMs: 500, now: () => clock.now });
    return { clock, store };
};

describe('analysis store', () => {
    it('queues a package once, however often it is asked for', () => {
        const { store } = setup();
        expect(store.findOrEnqueue(REF).status).toBe('queued');
        expect(store.findOrEnqueue(REF).status).toBe('queued');
        expect(store.claim()?.package).toEqual(REF);
        expect(store.claim()).toBeUndefined();
    });

    it('serves a finished result', () => {
        const { store } = setup();
        store.findOrEnqueue(REF);
        const job = store.claim();
        expect(store.findOrEnqueue(REF).status).toBe('running');
        expect(store.complete(job?.id ?? 0, RESULT)).toBe(true);
        expect(store.find(REF)).toMatchObject({ status: 'done', result: RESULT });
    });

    it('takes a job from a silent worker, then gives up after its attempts', () => {
        const { clock, store } = setup();
        store.findOrEnqueue(REF);
        const first = store.claim();
        clock.now += 101;
        const second = store.claim();
        expect(second?.id).toBe(first?.id);
        clock.now += 101;
        expect(store.claim()).toBeUndefined();
        expect(store.find(REF)).toMatchObject({ status: 'failed', failure: { code: 'TIMEOUT' } });
    });

    it('drops the late answer of a worker that lost its job', () => {
        const { clock, store } = setup();
        store.findOrEnqueue(REF);
        const job = store.claim();
        clock.now += 101;
        store.claim();
        clock.now += 101;
        store.claim();
        expect(store.complete(job?.id ?? 0, RESULT)).toBe(false);
    });

    it('tries a failed package again only after a while', () => {
        const { clock, store } = setup();
        store.findOrEnqueue(REF);
        store.fail(store.claim()?.id ?? 0, { code: 'BUNDLE_FAILED', message: 'no' });
        expect(store.findOrEnqueue(REF).status).toBe('failed');
        clock.now += 500;
        expect(store.findOrEnqueue(REF).status).toBe('queued');
    });

    it('refuses new work when too much is waiting', () => {
        const { store } = setup(1);
        store.findOrEnqueue(REF);
        expect(() => store.findOrEnqueue({ name: 'other', version: '1.0.0' })).toThrow('waiting');
    });
});
