import { ApiError, type AnalysisResponse } from '@pkg-guard/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrendsSearch } from '@lib/trends';
import { registerWebMcpTools, webMcpTools, type WebMcpDeps } from '@lib/webmcp';

const QUEUED: AnalysisResponse = { status: 'queued', package: { name: 'react', version: '19.1.0' }, analyzerVersion: 1 };

const setup = () => {
    const opened: string[] = [];
    const compared: TrendsSearch[] = [];
    const asked: string[] = [];
    const deps: WebMcpDeps = {
        api: {
            analysis: async (spec) => {
                asked.push(spec);
                return QUEUED;
            },
            search: async (query) => [{ name: query, version: '1.0.0', description: null, weeklyDownloads: null }],
            history: async (name) => ({ name, versions: [] }),
            downloads: async (name) => ({
                name,
                days: [
                    { day: '2026-10-05', downloads: 2 },
                    { day: '2026-10-06', downloads: 2 },
                    { day: '2026-10-07', downloads: 2 },
                    { day: '2026-10-08', downloads: 2 },
                    { day: '2026-10-09', downloads: 2 },
                    { day: '2026-10-10', downloads: 2 },
                    { day: '2026-10-11', downloads: 2 },
                ],
            }),
            metadata: async (name, version) => ({ name, version, deprecated: null, license: 'MIT', types: 'none', typesPackage: null, installScripts: [] }),
        },
        showPackage: async (spec) => {
            opened.push(spec);
        },
        showTrends: async (search) => {
            compared.push(search);
        },
    };
    const tool = (name: string) => {
        const found = webMcpTools(deps).find((candidate) => candidate.name === name);
        if (found === undefined) throw new Error(`no tool ${name}`);
        return found;
    };
    return { tool, opened, compared, asked };
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('WebMCP tools', () => {
    it('reads what a package costs without moving the page, and says to call again while it is measured', async () => {
        const { tool, opened, asked } = setup();
        const answer = await tool('get_package_cost').execute({ package: ' react@19.1.0 ' }, undefined);
        expect(asked).toEqual(['react@19.1.0']);
        expect(answer).toMatchObject({ status: 'queued', next: expect.stringContaining('call again'), url: expect.stringMatching(/\/package\/react$/) });
        expect(opened).toEqual([]);
    });

    it('refuses what is no package, before asking anything', async () => {
        const { tool, asked, opened } = setup();
        await expect(tool('get_package_cost').execute({ package: 'not a package' }, undefined)).rejects.toBeInstanceOf(ApiError);
        await expect(tool('open_package').execute({}, undefined)).rejects.toBeInstanceOf(ApiError);
        await expect(tool('get_version_history').execute({ package: 'react@1.0.0' }, undefined)).rejects.toThrow(/without a version/);
        expect(asked).toEqual([]);
        expect(opened).toEqual([]);
    });

    it('asks the registry about one exact version', async () => {
        const { tool } = setup();
        expect(await tool('get_package_metadata').execute({ name: 'react', version: '19.1.0' }, undefined)).toMatchObject({ name: 'react', version: '19.1.0', license: 'MIT' });
    });

    it('counts downloads by the period asked for, a week unless told otherwise', async () => {
        const { tool } = setup();
        const answer = await tool('get_downloads').execute({ package: 'react' }, undefined);
        expect(answer).toEqual({ name: 'react', range: '1y', group: 'week', points: [{ start: '2026-10-05', downloads: 14 }] });
    });

    it('opens a package for the user', async () => {
        const { tool, opened } = setup();
        expect(await tool('open_package').execute({ package: '@scope/name@1.0.0' }, undefined)).toMatchObject({
            opened: '@scope/name@1.0.0',
            url: expect.stringMatching(/\/package\/@scope\/name@1\.0\.0$/),
        });
        expect(opened).toEqual(['@scope/name@1.0.0']);
    });

    it('compares packages on the page, as the address says it, and needs at least one', async () => {
        const { tool, compared } = setup();
        const answer = await tool('show_trends').execute({ packages: ['react', 'vue', 'not a package'], metric: 'downloads', range: '3y' }, undefined);
        expect(compared).toEqual([{ packages: 'react,vue', metric: 'downloads', range: '3y' }]);
        expect(answer).toMatchObject({ shown: ['react', 'vue'], pageUrl: expect.stringMatching(/\/trends\?packages=react%2Cvue&metric=downloads&range=3y$/) });
        await expect(tool('show_trends').execute({ packages: [] }, undefined)).rejects.toThrow(/at least one/);
    });

    it('marks the tools that only read, and those that return text from package authors', () => {
        const { tool } = setup();
        expect(tool('get_package_metadata').annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
        // Asking for the cost may queue a measurement, so it does not claim to only read.
        expect(tool('get_package_cost').annotations).toEqual({ untrustedContentHint: true });
        expect(tool('show_trends').annotations.readOnlyHint).toBeUndefined();
    });
});

describe('registering the tools', () => {
    const tools = () => webMcpTools({ api: {} as WebMcpDeps['api'], showPackage: async () => undefined, showTrends: async () => undefined });

    it('does nothing in a browser without WebMCP', () => {
        vi.stubGlobal('document', {});
        vi.stubGlobal('navigator', {});
        expect(() => registerWebMcpTools(tools())()).not.toThrow();
    });

    it('registers with document.modelContext and takes them back through the signal', async () => {
        const registered: { tool: Record<string, unknown>; signal: AbortSignal | undefined }[] = [];
        vi.stubGlobal('document', {
            modelContext: { registerTool: async (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void registered.push({ tool, signal: options?.signal }) },
        });
        const unregister = registerWebMcpTools(tools());
        expect(registered.map((entry) => entry.tool['name'])).toContain('get_package_cost');
        unregister();
        expect(registered.every((entry) => entry.signal?.aborted === true)).toBe(true);
    });

    it('answers the earlier navigator.modelContext with MCP content blocks', async () => {
        const registered: Record<string, unknown>[] = [];
        const unregistered: string[] = [];
        vi.stubGlobal('document', {});
        vi.stubGlobal('navigator', { modelContext: { registerTool: (tool: Record<string, unknown>) => void registered.push(tool), unregisterTool: (name: string) => void unregistered.push(name) } });
        const unregister = registerWebMcpTools(
            webMcpTools({ showPackage: async () => undefined, showTrends: async () => undefined, api: { history: async (name: string) => ({ name, versions: [] }) } as unknown as WebMcpDeps['api'] }),
        );
        const history = registered.find((tool) => tool['name'] === 'get_version_history')?.['execute'] as (input: unknown) => Promise<{ content: { type: string; text: string }[] }>;
        const result = await history({ package: 'react' });
        expect(result.content[0]?.type).toBe('text');
        expect(JSON.parse(result.content[0]?.text ?? '{}')).toEqual({ name: 'react', versions: [] });
        unregister();
        expect(unregistered).toContain('get_package_cost');
    });
});
