import { describe, expect, it } from 'vitest';
import { PRERENDERED_PAGES, PUBLIC_PAGES, STATIC_PAGES, publicPage } from '@lib/documents/pages';
// The build helpers live beside the Vite config, which no alias reaches yet (tsconfig has none for `vite/`).
// oxlint-disable-next-line eslint/no-restricted-imports
import { requireIndexingDecision } from '../vite/buildEnv.ts';
// oxlint-disable-next-line eslint/no-restricted-imports
import { getTanstackStartPages } from '../vite/pages.ts';
// oxlint-disable-next-line eslint/no-restricted-imports
import { routeRules } from '../vite/routeRules.ts';

describe('the public pages', () => {
    it('are listed once, the home page first, and only those whose content never depends on the request are prerendered', () => {
        expect(STATIC_PAGES).toEqual(['/', '/about', '/trends', '/api', '/mcp', '/architecture', '/changelog']);
        expect(PRERENDERED_PAGES).toEqual(['/', '/about', '/api', '/mcp', '/architecture', '/changelog']);
        expect(getTanstackStartPages()).toEqual([{ path: '/' }, { path: '/about' }, { path: '/api' }, { path: '/mcp' }, { path: '/architecture' }, { path: '/changelog' }]);
        expect(new Set(PUBLIC_PAGES.map((page) => page.path)).size).toBe(PUBLIC_PAGES.length);
        expect(publicPage('/about').title).toBe('How it works');
        expect(() => publicPage('/nowhere')).toThrow(/PUBLIC_PAGES/);
    });

    it('leave the route rules to static files: the server sets the page headers (policy, cache) itself, and a rule would override them', () => {
        const rules = routeRules(true);
        expect(rules['/**']?.headers).toMatchObject({ 'X-Frame-Options': 'DENY' });
        expect(rules['/**']?.headers).not.toHaveProperty('X-Robots-Tag');
        expect(rules['/**']?.headers).not.toHaveProperty('Content-Security-Policy');
        expect(routeRules(false)['/**']?.headers).toMatchObject({ 'X-Robots-Tag': 'noindex, nofollow' });
        for (const path of [...PRERENDERED_PAGES, '/trends']) expect(rules, path).not.toHaveProperty(path);
    });
});

describe('requireIndexingDecision', () => {
    it('refuses an indexed build that names a local origin', () => {
        expect(() => requireIndexingDecision({ VITE_SITE_URL: 'http://localhost:3100', VITE_ALLOW_INDEXING: 'true' })).toThrow(/VITE_SITE_URL/);
        expect(() => requireIndexingDecision({ VITE_ALLOW_INDEXING: 'true' })).toThrow(/not set/);
    });

    it('refuses a production build that would ship noindex, once the production origin is known', () => {
        expect(() => requireIndexingDecision({ VITE_SITE_URL: 'https://example.test', VITE_ALLOW_INDEXING: 'false' }, 'https://example.test')).toThrow(/VITE_ALLOW_INDEXING/);
        expect(() => requireIndexingDecision({ VITE_SITE_URL: 'https://example.test/' }, 'https://example.test')).toThrow();
    });

    it('lets production with indexing and any other origin through', () => {
        expect(() => requireIndexingDecision({ VITE_SITE_URL: 'https://example.test', VITE_ALLOW_INDEXING: 'true' }, 'https://example.test')).not.toThrow();
        expect(() => requireIndexingDecision({ VITE_SITE_URL: 'http://localhost:3100', VITE_ALLOW_INDEXING: 'false' }, 'https://example.test')).not.toThrow();
        expect(() => requireIndexingDecision({ VITE_SITE_URL: 'https://staging.example.test' }, 'https://example.test')).not.toThrow();
        expect(() => requireIndexingDecision({})).not.toThrow();
    });
});
