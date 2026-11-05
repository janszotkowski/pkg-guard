import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openApiDocument } from '@pkg-guard/core';
import { describe, expect, it } from 'vitest';
import { siteConfig } from '@config/site';
import { DOC_PAGES, doc as lazyDoc, docsUrl, headingId, type Doc } from '@lib/docs';
import apiSource from '@docs/API.md?raw';
import mcpSource from '@docs/MCP.md?raw';

const apiDoc = lazyDoc(apiSource)();
const mcpDoc = lazyDoc(mcpSource)();

type Node = { type?: unknown; href?: unknown; id?: unknown };

/** Every node of a parsed document, tables and lists included. */
const nodes = (value: unknown): Node[] => {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (value === null || typeof value !== 'object') return [];
    return [value as Node, ...Object.values(value).flatMap(nodes)];
};

const headingIds = (doc: Doc) => new Set(nodes(doc.document.children).flatMap((node) => (node.type === 'heading' && typeof node.id === 'string' ? [node.id] : [])));
const hrefs = (doc: Doc) => nodes(doc.document.children).flatMap((node) => (node.type === 'link' && typeof node.href === 'string' ? [node.href] : []));

const docs = { '/api': apiDoc, '/mcp': mcpDoc } satisfies Record<string, Doc>;
const repository = `${siteConfig.repository}/blob/main/`;
const root = fileURLToPath(new URL('../../../', import.meta.url));

describe.each(Object.entries(docs))('the document of %s', (_path, doc) => {
    it('gives every heading an id of its own', () => {
        const headings = nodes(doc.document.children).filter((node) => node.type === 'heading');
        expect(headingIds(doc).size).toBe(headings.length);
    });

    it('links only to headings that exist, in itself or in another document', () => {
        const broken = hrefs(doc).filter((href) => {
            const [path, hash] = href.split('#');
            if (hash === undefined) return false;
            const target = path === '' ? doc : docs[path as keyof typeof docs];
            return target === undefined || !headingIds(target).has(hash);
        });
        expect(broken).toEqual([]);
    });

    it('links into the repository only to files that exist', () => {
        const files = hrefs(doc)
            .filter((href) => href.startsWith(repository))
            .map((href) => href.slice(repository.length).split('#')[0] ?? '');
        expect(files.filter((file) => !existsSync(`${root}${file}`))).toEqual([]);
    });
});

describe('links of the documents', () => {
    it('slugs headings as GitHub does, so the same links work there', () => {
        expect(headingId('GET /v1/analyses')).toBe('get-v1analyses');
        expect(apiDoc.outline.map((entry) => entry.id)).toContain('get-v1openapijson');
    });

    it('sends a document that is a page to the page, the rest to GitHub', () => {
        expect(docsUrl('MCP.md')).toBe('/mcp');
        expect(docsUrl('API.md#get-v1analyses')).toBe('/api#get-v1analyses');
        expect(docsUrl('ARCHITECTURE.md#rate-limit')).toBe(`${repository}docs/ARCHITECTURE.md#rate-limit`);
        expect(docsUrl('../SECURITY.md')).toBe(`${repository}SECURITY.md`);
        expect(Object.values(DOC_PAGES).sort()).toEqual(Object.keys(docs).sort());
    });

    it('lets only web and mail addresses through as they are; any other scheme leads nowhere', () => {
        expect(docsUrl('mailto:someone@example.org')).toBe('mailto:someone@example.org');
        expect(docsUrl('#get-v1analyses')).toBe('#get-v1analyses');
        for (const url of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'ftp://example.org/x']) expect(docsUrl(url)).toBe('#');
    });
});

describe('the API reference', () => {
    it('has a section for every operation of the OpenAPI document', () => {
        const ids = new Set(apiDoc.outline.map((entry) => entry.id));
        for (const [path, operations] of Object.entries(openApiDocument().paths)) {
            for (const method of Object.keys(operations)) expect(ids, `${method} ${path}`).toContain(headingId(`${method.toUpperCase()} /v1${path}`));
        }
    });
});
