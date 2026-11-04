import type { AnalysisResponse } from '@pkg-guard/core';
import { describe, expect, it } from 'vitest';
import { canonicalUrl } from '@config/site';
import { llmsTxt } from '@lib/documents/llms';
import { markdownTokens, notMeasuredMarkdown, packageMarkdown, packagePathSpec, wantsMarkdown } from '@lib/documents/markdown';
import { robotsTxt } from '@lib/documents/robots';
import { securityTxt } from '@lib/documents/securityTxt';
import { sitemapXml } from '@lib/documents/sitemap';
import { clip, fullTitle, pageHead } from '@lib/head';

const metaOf = (head: ReturnType<typeof pageHead>, key: string, value: string) => head.meta.find((entry) => (entry as Record<string, string>)[key] === value) as { content?: string } | undefined;

describe('pageHead', () => {
    const head = pageHead({ title: 'react size', description: 'What react costs.', path: '/package/react', breadcrumbs: [{ name: 'Home', path: '/' }] });

    it('adds the brand once', () => {
        expect(fullTitle('react size')).toBe('react size | pkg-guard');
        expect(fullTitle('react size | pkg-guard')).toBe('react size | pkg-guard');
        expect(fullTitle('pkg-guard')).toBe('pkg-guard');
    });

    it('has one canonical address, and the same on the card', () => {
        expect(head.links).toEqual([{ rel: 'canonical', href: canonicalUrl('/package/react') }]);
        expect(metaOf(head, 'property', 'og:url')?.content).toBe(canonicalUrl('/package/react'));
    });

    it('has the site card when a page names no image', () => {
        expect(metaOf(head, 'property', 'og:image')?.content).toBe(canonicalUrl('/og/default.png'));
        expect(metaOf(head, 'name', 'twitter:card')?.content).toBe('summary_large_image');
    });

    it('keeps out of the index what asks to be', () => {
        const hidden = pageHead({ title: 'x', description: 'y', path: '/package/x@1.0.0', noindex: true });
        expect(metaOf(hidden, 'name', 'robots')?.content).toContain('noindex');
        expect(hidden.scripts).toEqual([]);
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

    it('the sitemap lists pages and measured packages, escaped', () => {
        const xml = sitemapXml([{ name: '@scope/a&b', measuredAt: '2026-11-04T00:00:00.000Z' }]);
        expect(xml).toContain(`<loc>${canonicalUrl('/trends')}</loc>`);
        expect(xml).toContain('/package/@scope/a&amp;b</loc><lastmod>2026-11-04T00:00:00.000Z</lastmod>');
    });

    it('security.txt expires within a year', () => {
        const expires = /Expires: (.+)/.exec(securityTxt(new Date('2026-01-01T00:00:00Z')))?.[1] ?? '';
        expect(Date.parse(expires)).toBeLessThan(Date.parse('2027-01-01T00:00:00Z'));
    });

    it('llms.txt states its limits and uses absolute addresses', () => {
        const text = llmsTxt();
        expect(text).toContain('Do not use');
        expect(text).toContain(canonicalUrl('/trends'));
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
