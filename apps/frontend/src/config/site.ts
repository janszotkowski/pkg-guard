/** Only the production build lets search engines in; every other environment answers `noindex`. */
export const ALLOW_INDEXING: boolean = import.meta.env.VITE_ALLOW_INDEXING === 'true';

export const siteConfig = {
    title: 'pkg-guard',
    description: 'What an npm package really costs your bundle: minified, gzip and brotli sizes, measured with a modern bundler. Free and open.',
    repository: 'https://github.com/janszotkowski/pkg-guard',
} as const;
