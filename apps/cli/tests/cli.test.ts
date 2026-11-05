import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResponse, AnalysisResult } from '@pkg-guard/core';
import { DEFAULT_API_URL, run, type CliIo } from '@src/cli.ts';

const RESULT: AnalysisResult = {
    bundler: { name: 'rolldown', version: '1.0.0' },
    entry: 'export-star',
    commands: [],
    composition: { packages: [], total: 0 },
    sizes: { minified: 7500, gzip: 2900, brotli: 2600 },
    install: { bytes: 1_250_000, packages: 3 },
    peerDependencies: [],
    description: '\u001b[31mfrom the author',
    environment: { nodeBuiltins: [], nativeAddons: 0, unresolvedImports: 0 },
    repositoryUrl: null,
    timingsMs: { install: 1, bundle: 1, compress: 1 },
};

const base = { package: { name: 'react', version: '19.1.0' }, analyzerVersion: 1 };
const DONE: AnalysisResponse = { ...base, status: 'done', result: RESULT, exports: { status: 'unavailable' } };

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

/** The command with every answer of the API given in advance; nothing here reaches the network. */
const setup = (answers: Response[], env: CliIo['env'] = {}) => {
    const out: string[] = [];
    const err: string[] = [];
    const fetchStub = vi.fn<typeof fetch>(() => Promise.resolve(answers.shift() ?? json({ error: { code: 'INTERNAL', message: 'No more answers' } }, 500)));
    const io: CliIo = { fetch: fetchStub, env, out: (text) => out.push(text), err: (text) => err.push(text), pollMs: 0 };
    return { io, fetchStub, out: () => out.join(''), err: () => err.join('') };
};

describe('pkg-guard', () => {
    it('prints the sizes of a measured package and nothing its author wrote', async () => {
        const { io, fetchStub, out } = setup([json(DONE)]);
        expect(await run(['react'], io)).toBe(0);
        expect(out()).toContain('react@19.1.0');
        expect(out()).toContain('2.9 kB');
        expect(out()).toContain('1.25 MB, 3 packages');
        expect(out()).not.toContain('from the author');
        expect(String(fetchStub.mock.calls[0]?.[0])).toContain(`${DEFAULT_API_URL}/v1/analyses?package=react&analyzer=`);
    });

    it('asks again while it is measured, by the exact version once it is known', async () => {
        const { io, fetchStub } = setup([json({ ...base, status: 'queued' }), json({ ...base, status: 'running' }), json(DONE)]);
        expect(await run(['react'], io)).toBe(0);
        expect(fetchStub).toHaveBeenCalledTimes(3);
        expect(String(fetchStub.mock.calls[1]?.[0])).toContain('package=react%4019.1.0');
    });

    it('gives up after a while and says so', async () => {
        const { io, err } = setup([json({ ...base, status: 'queued' })]);
        expect(await run(['react'], { ...io, waitMs: 0 })).toBe(1);
        expect(err()).toContain('still being measured');
    });

    it('prints the whole answer as JSON', async () => {
        const { io, out } = setup([json(DONE)]);
        expect(await run(['react', '--json'], io)).toBe(0);
        expect(JSON.parse(out())).toEqual(DONE);
    });

    it('names a failure by its code alone', async () => {
        const { io, err } = setup([json({ ...base, status: 'failed', failure: { code: 'INSTALL_FAILED', message: '\u001b[31mwhat the install printed' } })]);
        expect(await run(['react'], io)).toBe(1);
        expect(err()).toBe('react@19.1.0 could not be measured (INSTALL_FAILED).\n');
    });

    it("says the API's own error", async () => {
        const { io, err } = setup([json({ error: { code: 'NOT_FOUND', message: 'missing is not on npm' } }, 404)]);
        expect(await run(['missing'], io)).toBe(1);
        expect(err()).toBe('missing is not on npm\n');
    });

    it('says when the API cannot be reached', async () => {
        const { io, err } = setup([]);
        expect(await run(['react'], { ...io, fetch: () => Promise.reject(new TypeError('fetch failed')) })).toBe(1);
        expect(err()).toBe(`No usable answer from the API at ${DEFAULT_API_URL}.\n`);
    });

    it('takes the API from the option before the environment, without a trailing slash', async () => {
        const fromEnv = setup([json(DONE)], { PKG_GUARD_API_URL: 'https://env.example' });
        await run(['react'], fromEnv.io);
        expect(String(fromEnv.fetchStub.mock.calls[0]?.[0])).toMatch(/^https:\/\/env\.example\/v1\//);
        const fromOption = setup([json(DONE)], { PKG_GUARD_API_URL: 'https://env.example' });
        await run(['react', '--api', 'https://option.example/'], fromOption.io);
        expect(String(fromOption.fetchStub.mock.calls[0]?.[0])).toMatch(/^https:\/\/option\.example\/v1\//);
    });

    it.each([[[]], [['not a package']], [['react', 'vue']], [['react', '--nope']], [['react', '--api', 'file:///etc/passwd']]])('refuses the command line %j before asking anything', async (argv) => {
        const { io, fetchStub, err } = setup([]);
        expect(await run(argv, io)).toBe(2);
        expect(err()).toContain('Usage:');
        expect(fetchStub).not.toHaveBeenCalled();
    });

    it('prints its usage when asked', async () => {
        const { io, out } = setup([]);
        expect(await run(['--help'], io)).toBe(0);
        expect(out()).toContain('Usage:');
    });
});
