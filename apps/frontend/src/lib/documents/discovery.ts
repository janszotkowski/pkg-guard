import { SITE_URL, canonicalUrl, siteConfig } from '@config/site';

/**
 * `/.well-known/ai-catalog.json` (Agentic Resource Discovery, ai-catalog data model): what an agent can use here, each
 * with a few questions it answers.
 */
export const aiCatalog = (): string => {
    const host = new URL(SITE_URL).hostname;
    const id = (namespace: string, name: string) => `urn:air:${host}:${namespace}:${name}`;
    return JSON.stringify({
        specVersion: '1.0',
        host: { displayName: siteConfig.title, identifier: `did:web:${host}` },
        entries: [
            {
                identifier: id('document', 'llms'),
                displayName: `${siteConfig.title} for language models`,
                description: 'What the site is, how its numbers are made, its pages and its public read-only JSON API.',
                type: 'text/plain',
                url: canonicalUrl('/llms.txt'),
                representativeQueries: ['how large is an npm package in a bundle', 'gzip size of react', 'which export of date-fns is the largest', 'compare the size of react and vue'],
            },
        ],
    });
};
