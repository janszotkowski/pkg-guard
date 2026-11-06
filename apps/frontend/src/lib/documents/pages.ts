/**
 * The pages of the site itself, beside the package pages: the one list the sitemap, the prerender (`vite/pages.ts`) and
 * the routes read, with the copy each page's head carries, so the tests check what the pages really say. Free of
 * imports: the Vite config reads it before any alias exists.
 */
export type PublicPage = {
    path: string;
    /** The page's own title (the brand is added once); on the home page its heading too, so the tab and the page say the same. */
    title: string;
    /** For a search result: 110 to 160 characters. The home page describes the site itself (`siteConfig.description`). */
    description?: string;
    /** Rendered once at build time, as a static file: only a page whose content never depends on the request. */
    prerender: boolean;
};

export const PUBLIC_PAGES: readonly PublicPage[] = [
    { path: '/', title: 'What an npm package really costs', prerender: true },
    {
        path: '/about',
        title: 'How it works',
        description: 'What weighme downloads from npm, how packages are handled without running them, and how sizes and download times are worked out.',
        prerender: true,
    },
    // The address takes the packages compared (`?packages=react,vue`), and a static file would answer every comparison with the empty page.
    {
        path: '/trends',
        title: 'npm package trends: compare size and downloads',
        description: 'Compare npm packages side by side: minified and gzip size across releases, downloads over time, install size and GitHub stars.',
        prerender: false,
    },
    {
        path: '/api',
        title: 'API documentation',
        description: 'The free public weighme API: every endpoint and field, with rate limits, error codes and examples for scripts and command-line tools.',
        prerender: true,
    },
    {
        path: '/mcp',
        title: 'MCP server',
        description: 'Let an AI assistant check what an npm package costs: the free weighme MCP server, how to add it to Claude, Cursor or VS Code, and its tools.',
        prerender: true,
    },
    {
        path: '/architecture',
        title: 'How it’s built',
        description: 'How weighme is built: how a package is measured end to end, how untrusted code is kept contained, the rate limit and the threat model.',
        prerender: true,
    },
    {
        path: '/changelog',
        title: 'Changelog',
        description: 'What changed on weighme and in its public API, newest first: new features, API versions and the versioning policy that keeps scripts working.',
        prerender: true,
    },
];

/** The paths of the site's own pages, the home page first. */
export const STATIC_PAGES: readonly string[] = PUBLIC_PAGES.map((page) => page.path);

/** The pages built once at build time. */
export const PRERENDERED_PAGES: readonly string[] = PUBLIC_PAGES.filter((page) => page.prerender).map((page) => page.path);

/** The copy of one of the site's own pages; a route asking for a path not listed is a mistake caught at startup. */
export const publicPage = (path: string): PublicPage => {
    const page = PUBLIC_PAGES.find((candidate) => candidate.path === path);
    if (page === undefined) throw new Error(`${path} is not in PUBLIC_PAGES (src/lib/documents/pages.ts)`);
    return page;
};
