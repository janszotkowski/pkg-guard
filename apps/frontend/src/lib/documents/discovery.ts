import { API_URL } from '@config/api';
import { SITE_URL, canonicalUrl, siteConfig } from '@config/site';

/** Where the API is described until it has an OpenAPI document: the architecture notes name every endpoint. */
export const API_DOCUMENTATION_URL = `${siteConfig.repository}/blob/main/docs/ARCHITECTURE.md`;

/**
 * `/.well-known/ai-catalog.json` (Agentic Resource Discovery, ai-catalog data model): what an agent can use here, the
 * API and the site's description for language models, each with a few questions it answers.
 */
export const aiCatalog = (): string => {
    const host = new URL(SITE_URL).hostname;
    const id = (namespace: string, name: string) => `urn:air:${host}:${namespace}:${name}`;
    return JSON.stringify({
        specVersion: '1.0',
        host: { displayName: siteConfig.title, identifier: `did:web:${host}` },
        entries: [
            {
                identifier: id('api', 'packages'),
                displayName: `${siteConfig.title} API`,
                description:
                    'Public read-only JSON API: the measured minified, gzip and brotli size of an npm package, the size of each of its exports, what its bundle is made of, its size across releases, downloads, GitHub stars and what the registry says of a version.',
                type: 'application/json',
                url: `${API_URL}/v1/`,
                documentation: API_DOCUMENTATION_URL,
                representativeQueries: ['measured gzip size of react as JSON', 'size of each release of lodash', 'weekly downloads of vue over the last year', 'is this npm version deprecated'],
            },
            {
                identifier: id('mcp', 'packages'),
                displayName: `${siteConfig.title} MCP server`,
                description: 'Model Context Protocol server (Streamable HTTP, no key): what an npm package costs a bundle and what the registry says of a version.',
                type: 'application/json',
                url: `${API_URL}/v1/mcp`,
                representativeQueries: ['what does this dependency cost before I add it', 'is this npm package deprecated'],
            },
            {
                identifier: id('document', 'llms'),
                displayName: `${siteConfig.title} for language models`,
                description: 'What the site is, how its numbers are made, where its data comes from, its pages and its public read-only JSON API.',
                type: 'text/plain',
                url: canonicalUrl('/llms.txt'),
                representativeQueries: ['how large is an npm package in a bundle', 'gzip size of react', 'which export of date-fns is the largest', 'compare the size of react and vue'],
            },
        ],
    });
};
