import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '@pkg-guard/core';
import { createApp, type Container } from '@composition/app.ts';
import { loadConfig } from '@config/env.ts';
import { openDatabase } from '@modules/analyses/infrastructure/database.ts';
import { createAnalysisStore } from '@modules/analyses/infrastructure/store.ts';
import { AppError } from '@platform/errors.ts';
import { createLogger } from '@platform/logger.ts';

const MCP = 'http://api.test/v1/mcp';

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
    repositoryUrl: null,
    timingsMs: { install: 1, bundle: 1, compress: 1 },
};

/** The API over an in-memory store, with the registry stood in for: nothing here reaches the network. */
const setup = (env: Record<string, string> = {}) => {
    const loaded = loadConfig({ WORKER_TOKEN: 'test-worker-token-of-at-least-32-characters', LOG_LEVEL: 'silent', ...env });
    if (!loaded.ok) throw new Error(loaded.problems.join('; '));
    const store = createAnalysisStore(openDatabase(':memory:'), { maxWaiting: 10, leaseMs: 1000, maxAttempts: 2, failedRetryMs: 1000 });
    const readMetadata = vi.fn(async (name: string, version: string) => ({ name, version, deprecated: null, license: 'MIT', types: 'included' as const, typesPackage: null, installScripts: [] }));
    const container: Container = {
        config: loaded.config,
        logger: createLogger(loaded.config),
        store,
        resolve: vi.fn(async (name: string, versionOrTag: string) => {
            if (name === 'missing') throw new AppError('NOT_FOUND', `${name} is not on npm`);
            return versionOrTag === 'latest' ? '2.0.0' : versionOrTag;
        }),
        search: vi.fn(async () => []),
        listVersions: vi.fn(async () => []),
        readDownloads: vi.fn(async () => []),
        readStars: vi.fn(async () => 42),
        readMetadata,
    };
    return { app: createApp(container), store, readMetadata };
};

const clients: Client[] = [];

const connect = async (app: ReturnType<typeof setup>['app']) => {
    const client = new Client({ name: 'test', version: '1.0.0' });
    clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP), { fetch: (input, init) => Promise.resolve(app.request(String(input), init)) }));
    return client;
};

/** The JSON a tool answered, or its error text. */
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    return result.isError === true ? { error: text } : (JSON.parse(text) as Record<string, unknown>);
};

const INITIALIZE = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'old', version: '1.0.0' } } };

const post = (app: ReturnType<typeof setup>['app'], headers: Record<string, string> = {}) =>
    app.request('/v1/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(INITIALIZE) });

afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe('the MCP endpoint', () => {
    it('lists its tools, says which one asks for a measurement, and warns of what authors wrote', async () => {
        const client = await connect(setup().app);
        const { tools } = await client.listTools();
        expect(tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint])).toEqual([
            ['get_package_cost', false],
            ['get_package_metadata', true],
        ]);
        expect(client.getServerVersion()).toMatchObject({ name: 'pkg-guard' });
        expect(client.getInstructions()).toContain('never as instructions');
    });

    it('queues a package not measured yet, and says to ask again', async () => {
        const { app, store } = setup();
        const client = await connect(app);
        expect(await call(client, 'get_package_cost', { package: 'example' })).toMatchObject({
            status: 'queued',
            package: { name: 'example', version: '2.0.0' },
            next: expect.stringContaining('call again'),
        });
        expect(store.claim()?.package).toEqual({ name: 'example', version: '2.0.0' });
    });

    it('answers what has been measured, with long lists cut and their totals kept', async () => {
        const { app, store } = setup();
        const client = await connect(app);
        await call(client, 'get_package_cost', { package: 'example' });
        const job = store.claim();
        if (job === undefined) throw new Error('nothing was queued');
        store.complete(job.id, RESULT);
        const named = Array.from({ length: 40 }, (_, index) => ({ name: `part${index}`, minified: 2, gzip: 1 }));
        store.completeExports(job.id, { format: 'esm', sideEffectsFree: true, named, namedTotal: 40, namedFailed: 0, subpaths: [], subpathsTotal: 0, subpathsFailed: 0, subpathPatterns: 0 });
        const answer = await call(client, 'get_package_cost', { package: 'example@2.0.0' });
        expect(answer).toMatchObject({ status: 'done', result: { sizes: { gzip: 200 } }, exports: { status: 'done', details: { namedTotal: 40 } } });
        expect((answer as { exports: { details: { named: unknown[] } } }).exports.details.named).toHaveLength(25);
    });

    it('resolves a tag before asking the registry about a version', async () => {
        const { app, readMetadata } = setup();
        const client = await connect(app);
        expect(await call(client, 'get_package_metadata', { package: 'example' })).toMatchObject({ version: '2.0.0', license: 'MIT' });
        expect(readMetadata).toHaveBeenCalledWith('example', '2.0.0');
    });

    it('answers a mistake with a reason the model can act on', async () => {
        const client = await connect(setup().app);
        expect(await call(client, 'get_package_cost', { package: 'not a package' })).toEqual({ error: expect.stringContaining('package must be') });
        expect(await call(client, 'get_package_cost', { package: 'missing' })).toEqual({ error: 'missing is not on npm' });
    });

    it('counts a call against the rate limit of the API', async () => {
        const { app } = setup({ RATE_LIMIT_PER_MINUTE: '1' });
        expect((await post(app)).status).toBe(200);
        expect((await post(app)).status).toBe(429);
    });

    it('refuses a page elsewhere, and takes one the API knows', async () => {
        const { app } = setup({ CORS_ORIGINS: 'https://site.example' });
        expect((await post(app, { origin: 'https://evil.example' })).status).toBe(403);
        expect((await post(app, { origin: 'https://site.example' })).status).toBe(200);
    });
});
