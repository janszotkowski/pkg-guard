import { createHighlighter } from '@tanstack/highlight/core';
import { json } from '@tanstack/highlight/languages/json';
import { plaintext } from '@tanstack/highlight/languages/plaintext';
import { shell } from '@tanstack/highlight/languages/shell';
import { ts } from '@tanstack/highlight/languages/ts';
import { createTanStackMarkdownHighlighter } from '@tanstack/highlight/markdown';
import type { InlineNode, MarkdownDocument } from '@tanstack/markdown';
import { parseMarkdown } from '@tanstack/markdown/parser';
import type { MarkdownReactOptions } from '@tanstack/markdown/react';
import { safeHref } from '@components/ExternalLink';
import { siteConfig } from '@config/site';

/** Only the languages the documents use; the same registrations on the server and in the browser, so hydration matches. */
const highlighter = createHighlighter({ languages: [json, plaintext, shell, ts] });

/** GitHub's heading ids (`### GET /v1/analyses` → `get-v1analyses`), so the links inside a file work here and on GitHub alike. */
export const headingId = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .trim()
        .replace(/\s/g, '-');

/** The files of `docs/` that are pages of the site, by the page they are. */
export const DOC_PAGES: Readonly<Record<string, string>> = { 'API.md': '/api', 'MCP.md': '/mcp', 'CHANGELOG.md': '/changelog' };

/** What a document may link to besides a page: a web address or a mailbox. Any other scheme is not a link. */
const DOC_LINK_SCHEMES: readonly string[] = ['https:', 'http:', 'mailto:'];

/**
 * A link of a document, for the site: another document that is a page goes to that page, the rest of the repository to
 * GitHub (relative to `docs/`). Anchors, web and `mailto:` addresses stay as they are; an address of any other scheme
 * (`javascript:`, say) leads nowhere.
 */
export const docsUrl = (url: string): string => {
    if (url.startsWith('#')) return url;
    if (/^[a-z][a-z\d+.-]*:/i.test(url)) return safeHref(url, DOC_LINK_SCHEMES) ?? '#';
    const [file = '', hash] = url.split('#');
    const page = DOC_PAGES[file];
    if (page !== undefined) return hash === undefined ? page : `${page}#${hash}`;
    return new URL(url, `${siteConfig.repository}/blob/main/docs/`).href;
};

export const docOptions = {
    headingAnchors: { ariaHidden: true },
    highlighter: createTanStackMarkdownHighlighter(highlighter),
} satisfies MarkdownReactOptions;

export type OutlineEntry = { id: string; text: string; depth: 2 | 3; code: boolean };

export type Doc = { document: MarkdownDocument; outline: OutlineEntry[] };

const plainText = (nodes: readonly InlineNode[]): string => nodes.map((node) => ('value' in node ? node.value : 'children' in node ? plainText(node.children) : '')).join('');

/** A document parsed, with its sections (h2) and subsections (h3) for the outline: both share the ids. */
const parseDoc = (source: string): Doc => {
    // A heading text seen before gets GitHub's suffix (`site`, `site-1`), so two "Site" sections are two anchors.
    const seen = new Map<string, number>();
    const uniqueId = (text: string): string => {
        const id = headingId(text);
        const count = seen.get(id) ?? 0;
        seen.set(id, count + 1);
        return count === 0 ? id : `${id}-${count}`;
    };
    const document = parseMarkdown(source, { headingIds: uniqueId, urlTransform: (_url, _kind, defaultUrl) => docsUrl(defaultUrl) });
    const outline = document.children.flatMap((node) =>
        node.type === 'heading' && (node.depth === 2 || node.depth === 3) && node.id !== undefined
            ? [{ id: node.id, text: plainText(node.children), depth: node.depth, code: node.children.every((child) => child.type === 'inlineCode') }]
            : [],
    );
    return { document, outline };
};

/**
 * A page's document, parsed the first time it is shown and kept. Each page imports its own file (`?raw`) and calls
 * this, so a page's bundle carries its one document and not the others.
 */
export const doc = (source: string): (() => Doc) => {
    let parsed: Doc | undefined;
    return () => (parsed ??= parseDoc(source));
};
