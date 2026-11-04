import { securityHeaders } from '../src/lib/securityHeaders.ts';

type RouteRules = Record<string, { headers: Record<string, string> }>;

/** Hashed build output (scripts, styles and the self-hosted fonts, which Vite emits under `/assets/`): a new build gets new names. */
const IMMUTABLE = { 'Cache-Control': 'public, max-age=31536000, immutable' };

/**
 * Nitro route rules: the headers static files get (they never reach `src/server.ts`) and their cache policy. Nothing the
 * server sets per response may be here (a route rule header would override it): the Content-Security-Policy and the
 * page Cache-Control stay in `src/server.ts`. With indexing off, static files are kept out of the index too.
 */
export const routeRules = (allowIndexing: boolean): RouteRules => ({
    '/**': { headers: { ...securityHeaders(), ...(allowIndexing ? {} : { 'X-Robots-Tag': 'noindex, nofollow' }) } },
    '/assets/**': { headers: IMMUTABLE },
});
