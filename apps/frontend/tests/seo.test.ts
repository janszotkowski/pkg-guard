import { readFileSync } from 'node:fs';
import type { AnalysisResponse } from '@weighme/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalUrl, siteConfig } from '@config/site';
import { aiCatalog, apiCatalog } from '@lib/documents/discovery';
import { llmsTxt } from '@lib/documents/llms';
import { markdownTokens, notMeasuredMarkdown, packageMarkdown, packagePathSpec, wantsMarkdown } from '@lib/documents/markdown';
import { PUBLIC_PAGES, STATIC_PAGES } from '@lib/documents/pages';
import { robotsTxt } from '@lib/documents/robots';
import { securityTxt } from '@lib/documents/securityTxt';
import { SITEMAP_PAGE_SIZE, packageSitemap, packageSitemapCount, packageSitemapPage, pagesSitemap, sitemapIndex } from '@lib/documents/sitemap';
import { clip, fullTitle, pageHead } from '@lib/head';

const metaOf = (head: ReturnType<typeof pageHead>, key: string, value: string) => head.meta.find((entry) => (entry as Record<string, string>)[key] === value) as { content?: string } | undefined;

/** A route's source, for what the tests cannot call without rendering the page: which nodes and labels it passes to `pageHead`. */
const routeSource = (name: string): string => readFileSync(new URL(`../src/routes/${name}`, import.meta.url), 'utf8');

describe('pageHead', () => {
    const head = pageHead({ title: 'react size', description: 'What react costs.', path: '/package/react', breadcrumbs: [{ name: 'Home', path: '/' }] });

    it('adds the brand once', () => {
        expect(fullTitle('react size')).toBe('react size | weighme');
        expect(fullTitle('react size | weighme')).toBe('react size | weighme');
        expect(fullTitle('weighme')).toBe('weighme');
    });

    it('has one canonical address, and the same on the card', () => {
        expect(head.links).toEqual([{ rel: 'canonical', href: canonicalUrl('/package/react') }]);
        expect(metaOf(head, 'property', 'og:url')?.content).toBe(canonicalUrl('/package/react'));
    });

    it('has the site card when a page names no image, and is a website unless told otherwise', () => {
        expect(metaOf(head, 'property', 'og:image')?.content).toBe(canonicalUrl('/og/default.png'));
        expect(metaOf(head, 'name', 'twitter:card')?.content).toBe('summary_large_image');
        expect(metaOf(head, 'property', 'og:type')?.content).toBe('website');
        expect(metaOf(pageHead({ title: 'x', description: 'y', path: '/x', ogType: 'article' }), 'property', 'og:type')?.content).toBe('article');
    });

    it('keeps out of the index what asks to be, and everything outside production', () => {
        // Tests run without VITE_ALLOW_INDEXING, like every environment but production.
        expect(metaOf(head, 'name', 'robots')?.content).toBe('noindex, nofollow');
        const hidden = pageHead({ title: 'x', description: 'y', path: '/package/x@1.0.0', noindex: true });
        expect(metaOf(hidden, 'name', 'robots')?.content).toBe('noindex, nofollow');
        expect(hidden.scripts).toEqual([]);
    });

    it('announces the Markdown twin and the language versions in the head when a page has them', () => {
        const withTwin = pageHead({ title: 'x', description: 'y', path: '/package/react', markdown: '/package/react.md' });
        expect(withTwin.links).toContainEqual({ rel: 'alternate', type: 'text/markdown', href: canonicalUrl('/package/react.md') });
        const translated = pageHead({
            title: 'x',
            description: 'y',
            path: '/about',
            alternates: [
                { hrefLang: 'en', path: '/about' },
                { hrefLang: 'x-default', path: '/about' },
            ],
        });
        expect(translated.links).toContainEqual({ rel: 'alternate', hrefLang: 'x-default', href: canonicalUrl('/about') });
    });
});

describe('pageHead in production', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('says index, follow, and links every node of the graph by @id', async () => {
        vi.stubEnv('VITE_ALLOW_INDEXING', 'true');
        vi.resetModules();
        const { pageHead: indexed, WEBSITE_ID, AUTHOR_ID } = await import('@lib/head');
        const { canonicalUrl: url } = await import('@config/site');
        const head = indexed({
            title: 'How it works',
            description: 'x',
            path: '/about',
            breadcrumbs: [
                { name: 'Home', path: '/' },
                { name: 'How it works', path: '/about' },
            ],
            page: { '@type': 'AboutPage' },
            nodes: [{ '@type': 'WebApplication', '@id': `${url('/')}#application`, name: 'weighme' }],
        });
        expect(metaOf(head, 'name', 'robots')?.content).toBe('index, follow');
        const graph = (JSON.parse(head.scripts[0]?.children ?? '{}') as { '@graph': Record<string, unknown>[] })['@graph'];
        const ids = graph.map((node) => node['@id']);
        expect(ids).toEqual([WEBSITE_ID, AUTHOR_ID, `${url('/about')}#webpage`, `${url('/about')}#breadcrumb`, `${url('/')}#application`]);
        expect(new Set(ids).size).toBe(ids.length);
        const website = graph[0] as { publisher: { '@id': string } };
        const page = graph[2] as { '@type': string; isPartOf: { '@id': string }; breadcrumb: { '@id': string } };
        expect(website.publisher['@id']).toBe(AUTHOR_ID);
        expect(page['@type']).toBe('AboutPage');
        expect(page.isPartOf['@id']).toBe(WEBSITE_ID);
        expect(page.breadcrumb['@id']).toBe(`${url('/about')}#breadcrumb`);
        expect((graph[3] as { itemListElement: { name: string; item: string }[] }).itemListElement[0]).toEqual({ '@type': 'ListItem', position: 1, name: 'Home', item: url('/') });
    });
});

describe('titles and descriptions', () => {
    // The copy the routes pass to pageHead, from the one list they read: unique, within what a result shows.
    const pages = PUBLIC_PAGES.map((page) => ({ ...page, description: page.description ?? siteConfig.description }));

    it.each(pages)('$path fits a search result', (page) => {
        expect(fullTitle(page.title).length).toBeLessThanOrEqual(60);
        expect(page.description.length).toBeGreaterThanOrEqual(110);
        expect(page.description.length).toBeLessThanOrEqual(160);
    });

    it('says something different on every page', () => {
        expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
        expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);
    });

    it('is what the routes use: the home heading is its title, the pages their list, the breadcrumb root Home', () => {
        const home = routeSource('index.tsx');
        expect(home).toContain("publicPage('/')");
        expect(home).toContain("<h1 className={'text-display text-balance'}>{PAGE.title}</h1>");
        expect(home).toContain("'@type': 'WebApplication'");
        expect(home).toContain('#application`');
        expect(routeSource('about.tsx')).toContain("page: { '@type': 'AboutPage' }");
        expect(routeSource('trends.tsx')).toContain("page: { '@type': 'CollectionPage' }");
        for (const name of ['about.tsx', 'trends.tsx', 'package.$.tsx']) expect(routeSource(name), name).toContain("{ name: 'Home', path: '/' }");
    });
});

describe('clip', () => {
    it('cuts at a word and marks it', () => {
        const text = clip('one two three four five six', 12);
        expect(text.length).toBeLessThanOrEqual(12);
        expect(text.endsWith('…')).toBe(true);
    });

    it('leaves short text alone, on one line', () => {
        expect(clip('one\n two')).toBe('one two');
    });
});

describe('documents', () => {
    it('robots lets crawlers in only in production, and names the sitemap', () => {
        expect(robotsTxt(false)).toBe('User-agent: *\nDisallow: /\n');
        const production = robotsTxt(true);
        expect(production).toContain('User-agent: GPTBot');
        expect(production).toContain(`Sitemap: ${canonicalUrl('/sitemap.xml')}`);
        expect(production).not.toContain('Disallow');
    });

    it('the sitemap index names the pages file and one package file per fifty thousand', () => {
        expect(packageSitemapCount(0)).toBe(1);
        expect(packageSitemapCount(SITEMAP_PAGE_SIZE)).toBe(1);
        expect(packageSitemapCount(SITEMAP_PAGE_SIZE + 1)).toBe(2);
        const index = sitemapIndex(120_000);
        expect(index).toContain('<sitemapindex');
        expect(index).toContain(`<loc>${canonicalUrl('/sitemaps/pages.xml')}</loc>`);
        expect(index).toContain(`<loc>${canonicalUrl('/sitemaps/packages-3.xml')}</loc>`);
        expect(index).not.toContain('packages-4.xml');
        expect(sitemapIndex(0)).toContain('packages-1.xml');
    });

    it('the pages file lists the site pages without an invented date', () => {
        const xml = pagesSitemap();
        for (const path of STATIC_PAGES) expect(xml).toContain(`<loc>${canonicalUrl(path)}</loc>`);
        expect(xml).not.toContain('lastmod');
    });

    it('the package files cut the list at the file boundary, escaped, with the date of the measurement', () => {
        const packages = Array.from({ length: SITEMAP_PAGE_SIZE + 2 }, (_, index) => ({ name: `p${index}`, measuredAt: '2026-11-04T00:00:00.000Z' }));
        const first = packageSitemap(packages, 1);
        const second = packageSitemap(packages, 2);
        expect(first.match(/<url>/g)).toHaveLength(SITEMAP_PAGE_SIZE);
        expect(first).toContain(`/package/p${SITEMAP_PAGE_SIZE - 1}</loc>`);
        expect(first).not.toContain(`/package/p${SITEMAP_PAGE_SIZE}</loc>`);
        expect(second.match(/<url>/g)).toHaveLength(2);
        expect(second).toContain(`/package/p${SITEMAP_PAGE_SIZE}</loc>`);
        const xml = packageSitemap([{ name: '@scope/a&b', measuredAt: '2026-11-04T00:00:00.000Z' }], 1);
        expect(xml).toContain('/package/@scope/a&amp;b</loc><lastmod>2026-11-04T00:00:00.000Z</lastmod>');
        expect(xml).not.toContain('/trends');
    });

    it('reads only well-formed package file numbers', () => {
        expect(packageSitemapPage('/sitemaps/packages-2.xml')).toBe(2);
        expect(packageSitemapPage('/sitemaps/packages-0.xml')).toBeUndefined();
        expect(packageSitemapPage('/sitemaps/packages-x.xml')).toBeUndefined();
        expect(packageSitemapPage('/sitemaps/pages.xml')).toBeUndefined();
    });

    it('security.txt expires within a year', () => {
        const expires = /Expires: (.+)/.exec(securityTxt(new Date('2026-01-01T00:00:00Z')))?.[1] ?? '';
        expect(Date.parse(expires)).toBeLessThan(Date.parse('2027-01-01T00:00:00Z'));
    });

    it('llms.txt states what it measures and what it does not judge, names its data, and links only to pages that exist', () => {
        const text = llmsTxt();
        expect(text.startsWith(`# ${siteConfig.title}\n`)).toBe(true);
        expect(text).toContain('Do not use');
        expect(text).toContain('does not judge whether a package is safe');
        expect(text).toMatch(/## Data/);
        for (const source of ['registry.npmjs.org', 'api.npmjs.org', 'GitHub']) expect(text).toContain(source);
        const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) expect(STATIC_PAGES.map((path) => canonicalUrl(path))).toContain(link);
        for (const [, href] of text.matchAll(/\]\(([^)]+)\)/g)) expect(href).toMatch(/^https?:\/\//);
    });

    it('lists the API in an RFC 9727 catalog', () => {
        const [catalog, entry] = (JSON.parse(apiCatalog()) as { linkset: Record<string, unknown>[] }).linkset;
        expect(catalog?.['anchor']).toMatch(/\/\.well-known\/api-catalog$/);
        expect(catalog?.['item']).toEqual([expect.objectContaining({ href: entry?.['anchor'] })]);
        expect(entry?.['anchor']).toMatch(/\/v1$/);
        expect(entry).toHaveProperty('service-doc');
        expect(entry).toHaveProperty('service-desc');
        expect(entry).toHaveProperty('status');
    });

    it('describes the API and llms.txt in the ARD catalog, each with one of url or data', () => {
        const catalog = JSON.parse(aiCatalog()) as { specVersion: string; entries: Record<string, unknown>[] };
        expect(catalog.specVersion).not.toBe('');
        const api = catalog.entries.find((entry) => entry['displayName'] === `${siteConfig.title} API`);
        expect(api?.['url']).toBe(canonicalUrl('/.well-known/api-catalog'));
        for (const entry of catalog.entries) {
            expect(entry['identifier']).toMatch(/^urn:air:[^:]+:[^:]+:[^:]+$/);
            expect('url' in entry !== 'data' in entry).toBe(true);
            expect((entry['representativeQueries'] as string[]).length).toBeGreaterThanOrEqual(2);
        }
    });
});

describe('markdown for agents', () => {
    it('is what an agent asks for, never a browser', () => {
        expect(wantsMarkdown('text/markdown')).toBe(true);
        expect(wantsMarkdown('text/markdown, text/html;q=0.5')).toBe(true);
        expect(wantsMarkdown('text/html, text/markdown;q=0.5')).toBe(false);
        expect(wantsMarkdown('text/html,*/*;q=0.8')).toBe(false);
        expect(wantsMarkdown('*/*')).toBe(false);
        expect(wantsMarkdown(null)).toBe(false);
    });

    it('reads the package from the address, scope and twin', () => {
        expect(packagePathSpec('/package/react')).toEqual({ spec: 'react', twin: false });
        expect(packagePathSpec('/package/@scope/x.md')).toEqual({ spec: '@scope/x', twin: true });
        expect(packagePathSpec('/package/%40scope/x')).toEqual({ spec: '@scope/x', twin: false });
        expect(packagePathSpec('/trends')).toBeUndefined();
        // No package anyone could ask for: an encoding that does not decode, a name the registry refuses, a newline bound for a header.
        for (const path of ['/package/%E0', '/package/../etc', '/package/a%0D%0Ab', '/package/react@^19', '/package/>x']) expect(packagePathSpec(path)).toBeUndefined();
    });

    const measured: AnalysisResponse = {
        package: { name: 'x', version: '1.0.0' },
        analyzerVersion: 1,
        status: 'done',
        exports: { status: 'pending' },
        result: {
            bundler: { name: 'rolldown', version: '1.0.0' },
            entry: 'export-star',
            sizes: { minified: 2000, gzip: 1000, brotli: 900 },
            commands: [],
            composition: { packages: [], total: 0 },
            install: { bytes: 5000, packages: 1 },
            peerDependencies: [],
            description: 'Text with <b>html</b> in it',
            environment: { nodeBuiltins: [], nativeAddons: 0, unresolvedImports: 0 },
            repositoryUrl: null,
            timingsMs: { install: 1, bundle: 1, compress: 1 },
        },
    };

    it("says what the page says, and takes the author's text literally", () => {
        const markdown = packageMarkdown(measured);
        expect(markdown).toContain('# x@1.0.0');
        expect(markdown).toContain('**Minified and gzipped:** 1.0 kB');
        expect(markdown).toContain('\\<b\\>html\\</b\\>');
        expect(markdownTokens(markdown)).toBeGreaterThan(0);
    });

    it('says when a package has not been measured', () => {
        expect(notMeasuredMarkdown('x')).toContain('has not been measured');
    });
});
