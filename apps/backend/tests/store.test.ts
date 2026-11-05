import { describe, expect, it } from 'vitest';
import type { AnalysisResult, ExportDetails } from '@pkg-guard/core';
import { openDatabase } from '@modules/analyses/infrastructure/database.ts';
import { createAnalysisStore } from '@modules/analyses/infrastructure/store.ts';

const RESULT: AnalysisResult = {
    bundler: { name: 'rolldown', version: '1.0.0' },
    entry: 'export-star',
    commands: [],
    composition: { packages: [{ name: 'example', share: 1, modules: 1 }], total: 1 },
    sizes: { minified: 300, gzip: 200, brotli: 100 },
    install: { bytes: 1000, packages: 1 },
    peerDependencies: [],
    description: 'An example',
    environment: { nodeBuiltins: [], nativeAddons: 0, unresolvedImports: 0 },
    repositoryUrl: 'https://github.com/owner/example',
    timingsMs: { install: 1, bundle: 1, compress: 1 },
};

const DETAILS: ExportDetails = {
    format: 'esm',
    sideEffectsFree: true,
    named: [{ name: 'add', minified: 80, gzip: 60 }],
    namedTotal: 1,
    namedFailed: 0,
    subpaths: [{ path: './client', minified: 40, gzip: 30 }],
    subpathsTotal: 1,
    subpathsFailed: 0,
    subpathPatterns: 0,
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

    it('awaits the part-by-part numbers after the result, then serves them', () => {
        const { store } = setup();
        store.findOrEnqueue(REF);
        const id = store.claim()?.id ?? 0;
        store.complete(id, RESULT);
        expect(store.find(REF)).toMatchObject({ status: 'done', exports: { status: 'pending' } });
        expect(store.completeExports(id, DETAILS)).toBe(true);
        expect(store.find(REF)).toMatchObject({ status: 'done', result: RESULT, exports: { status: 'done', details: DETAILS } });
    });

    it('keeps the result when the part-by-part numbers fail', () => {
        const { store } = setup();
        store.findOrEnqueue(REF);
        const id = store.claim()?.id ?? 0;
        store.complete(id, RESULT);
        expect(store.failExports(id)).toBe(true);
        expect(store.find(REF)).toMatchObject({ status: 'done', result: RESULT, exports: { status: 'unavailable' } });
    });

    it('stops waiting for the numbers of a worker that went silent', () => {
        const { clock, store } = setup();
        store.findOrEnqueue(REF);
        store.complete(store.claim()?.id ?? 0, RESULT);
        clock.now += 100;
        expect(store.find(REF)).toMatchObject({ status: 'done', exports: { status: 'unavailable' } });
    });

    it('measures what someone is waiting for before what was queued for later', () => {
        const { store } = setup();
        store.enqueueLater([{ name: 'later', version: '1.0.0' }]);
        store.findOrEnqueue(REF);
        expect(store.claim()?.package).toEqual(REF);
        expect(store.claim()?.package.name).toBe('later');
    });

    it('moves a package up when someone starts waiting for it', () => {
        const { store } = setup();
        store.enqueueLater([{ name: 'later', version: '1.0.0' }]);
        store.enqueueLater([REF]);
        store.findOrEnqueue(REF);
        expect(store.claim()?.package).toEqual(REF);
    });

    it('leaves alone what is already known when queueing for later', () => {
        const { store } = setup();
        store.findOrEnqueue(REF);
        store.complete(store.claim()?.id ?? 0, RESULT);
        store.enqueueLater([REF]);
        expect(store.find(REF)?.status).toBe('done');
        expect(store.claim()).toBeUndefined();
    });

    it('lists only what has been measured', () => {
        const { store } = setup();
        store.findOrEnqueue(REF);
        store.findOrEnqueue({ name: 'waiting', version: '1.0.0' });
        store.complete(store.claim()?.id ?? 0, RESULT);
        expect(store.measuredPackages(10).map((entry) => entry.name)).toEqual(['example']);
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
