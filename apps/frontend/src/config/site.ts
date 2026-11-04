const configuredSiteUrl: unknown = import.meta.env.VITE_SITE_URL;

export const SITE_URL: string = (typeof configuredSiteUrl === 'string' && configuredSiteUrl !== '' ? configuredSiteUrl : 'http://localhost:3100').replace(/\/$/, '');

/** Only the production build lets search engines in; every other environment answers `noindex`. */
export const ALLOW_INDEXING: boolean = import.meta.env.VITE_ALLOW_INDEXING === 'true';

export const siteConfig = {
    title: 'pkg-guard',
    description: 'What an npm package really costs your bundle: minified, gzip and brotli sizes, measured with a modern bundler. Free and open source, no account.',
    repository: 'https://github.com/janszotkowski/pkg-guard',
    /** Who builds the site: the person behind it, with their real public profile only. */
    author: { name: 'Jan Szotkowski', url: 'https://github.com/janszotkowski', x: 'https://x.com/janszotkowskix', xHandle: '@janszotkowskix' },
} as const;

/** The public URL of a path: absolute, from the configured origin (never the request), no trailing slash except the root. */
export const canonicalUrl = (path: string): string => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized === '/' ? `${SITE_URL}/` : `${SITE_URL}${normalized.replace(/\/$/, '')}`;
};
