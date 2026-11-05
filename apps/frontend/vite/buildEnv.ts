/**
 * The origin the production build is for. Unknown until the site is deployed (docs/TODO.md): with it set, a build for
 * that origin with indexing off fails instead of shipping every page as `noindex`.
 */
export const PRODUCTION_ORIGIN: string | undefined = undefined;

const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

/**
 * Indexing and the origin must agree, and nobody would notice when they do not until the site dropped out of search or
 * named `localhost` as its canonical address. A build with indexing on needs a public origin, and a build for the
 * production origin needs indexing on; any other build sets its own `VITE_SITE_URL`.
 */
export const requireIndexingDecision = (env: Readonly<Record<string, string | undefined>>, productionOrigin: string | undefined = PRODUCTION_ORIGIN): void => {
    const origin = (env['VITE_SITE_URL'] ?? '').trim().replace(/\/$/, '');
    const indexing = env['VITE_ALLOW_INDEXING'] === 'true';
    if (indexing && (origin === '' || LOCAL_ORIGIN.test(origin))) {
        throw new Error(
            `VITE_ALLOW_INDEXING is "true" but VITE_SITE_URL is ${origin === '' ? 'not set' : origin}: every page would name a local address as its canonical one. Set the public origin (see apps/frontend/.env.example).`,
        );
    }
    if (productionOrigin !== undefined && origin === productionOrigin && !indexing) {
        throw new Error(
            `This build is for ${productionOrigin} but VITE_ALLOW_INDEXING is not "true", so every page would be noindex. Set VITE_ALLOW_INDEXING=true for production, or VITE_SITE_URL to this environment's own origin.`,
        );
    }
};
