import { brotliDecompressSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITEMAP_PAGE_SIZE } from '@lib/documents/sitemap';

const page = `<!DOCTYPE html><html><head><title>x</title></head><body>${'<p>A page long enough to be worth compressing.</p>'.repeat(60)}</body></html>`;

vi.mock('@tanstack/react-start/server-entry', () => ({
    default: { fetch: () => Promise.resolve(new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })) },
}));

const measured = { count: 1 };
vi.mock('@lib/api', () => ({
    fetchKnownAnalysis: () => Promise.resolve(undefined),
    fetchMeasuredPackages: () => Promise.resolve(Array.from({ length: measured.count }, (_, index) => ({ name: `p${index}`, measuredAt: '2026-11-04T00:00:00.000Z' }))),
}));

/** The server entry as production runs it: the policy is sent only there. */
const productionServer = async () => {
    vi.stubEnv('PROD', true);
    vi.resetModules();
    // The entry sits beside `src/lib`, where no alias reaches it.
    // oxlint-disable-next-line eslint/no-restricted-imports
    const { default: server } = await import('../src/server.ts');
    return (path: string, headers: Record<string, string> = {}) => server.fetch(new Request(`http://localhost:3100${path}`, { headers }));
};

describe('the server entry in production', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('sends a policy without hashes on a document that is not a page, and the security headers on everything', async () => {
        const get = await productionServer();
        const robots = await get('/robots.txt');
        expect(robots.headers.get('content-type')).toContain('text/plain');
        const policy = robots.headers.get('content-security-policy') ?? '';
        expect(policy).toContain("default-src 'self'");
        expect(policy).not.toContain('sha256-');
        expect(robots.headers.get('x-frame-options')).toBe('DENY');
        expect(robots.headers.get('content-encoding')).toBeNull();
    });

    it('answers the sitemap index and its files from one list, and refuses a file past the last', async () => {
        measured.count = SITEMAP_PAGE_SIZE + 1;
        const get = await productionServer();
        const index = await (await get('/sitemap.xml')).text();
        expect(index).toContain('/sitemaps/pages.xml');
        expect(index).toContain('/sitemaps/packages-2.xml');
        expect(index).not.toContain('packages-3.xml');
        expect(await (await get('/sitemaps/pages.xml')).text()).toContain('<loc>http://localhost:3100/about</loc>');
        expect((await (await get('/sitemaps/packages-2.xml')).text()).match(/<url>/g)).toHaveLength(1);
        const missing = await get('/sitemaps/packages-3.xml');
        expect(missing.status).toBe(404);
        expect(missing.headers.get('cache-control')).toBe('public, max-age=300');
        measured.count = 1;
    });

    it('compresses a page for a client that takes it, with its own policy, and keeps the encodings apart for caches', async () => {
        const get = await productionServer();
        const response = await get('/about', { accept: 'text/html', 'accept-encoding': 'gzip, br' });
        expect(response.headers.get('content-encoding')).toBe('br');
        expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding');
        expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");
        expect(response.headers.get('link')).toContain('rel="describedby"');
        expect(brotliDecompressSync(new Uint8Array(await response.arrayBuffer())).toString()).toBe(page);
        const plain = await get('/about', { accept: 'text/html' });
        expect(plain.headers.get('content-encoding')).toBeNull();
        expect(await plain.text()).toBe(page);
    });
});
