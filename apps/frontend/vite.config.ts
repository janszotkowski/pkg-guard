import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig, loadEnv } from 'vite';

import { requireIndexingDecision } from './vite/buildEnv.ts';
import { dropUseClientDirectiveWarning } from './vite/logs.ts';
import { getTanstackStartPages } from './vite/pages.ts';
import { routeRules } from './vite/routeRules.ts';

/**
 * The browser's API address is baked into the bundle at build time. Without it the app falls back to a local address,
 * which is right while developing and silently wrong anywhere else, so a build refuses to start without it.
 */
const requireApiUrl = (env: Record<string, string>): void => {
    if ((env['VITE_API_URL'] ?? '').trim() === '') {
        throw new Error('VITE_API_URL is not set. A build bakes the API address into the bundle; set it (see apps/frontend/.env.example).');
    }
};

/** Server-only settings read at request time (`process.env`): in development they come from `.env` like the rest. */
const SERVER_ENV = ['API_INTERNAL_URL', 'INTERNAL_API_TOKEN', 'CLIENT_IP_HEADER'] as const;

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    if (command === 'build') {
        requireApiUrl(env);
        requireIndexingDecision(env);
    }
    // Only the dev server: a build must never bake a secret into its output; production reads them from its environment.
    if (command === 'serve') {
        for (const name of SERVER_ENV) {
            const value = env[name];
            if (value !== undefined && process.env[name] === undefined) process.env[name] = value;
        }
    }
    const allowIndexing = env['VITE_ALLOW_INDEXING'] === 'true';
    return {
        server: { port: 3100 },
        // The prerender step of a build opens a preview server and fetches the pages from it. By the name `localhost` that fails in a container
        // (the server binds to ::1, the fetch goes to 127.0.0.1), so it is pinned to the address.
        preview: { host: '127.0.0.1' },
        resolve: { tsconfigPaths: true },
        plugins: [
            tanstackStart({
                // The pages whose content never depends on the request are rendered once at build time, from the list the sitemap reads
                // too: a page that fails to render fails the build, and the files are there for a host that serves static pages. The
                // Node server does not: the prerender writes them after Nitro has listed its public files, so `src/server.ts` renders
                // them per request, with the page's own Content-Security-Policy and cache policy.
                pages: getTanstackStartPages(),
                prerender: { enabled: true, crawlLinks: false, autoStaticPathsDiscovery: false },
                // `/sitemap.xml` is an index the server answers at run time (`src/server.ts`): a file by that name would be served instead of it.
                sitemap: { enabled: false },
            }),
            nitro({
                rolldownConfig: { onLog: dropUseClientDirectiveWarning },
                // The share-image renderer loads from node_modules as published: bundled, harfbuzz (inside satori) asks for `__dirname`, which an ES module lacks; `*` copies its whole package, `hb.wasm` included.
                traceDeps: ['satori', 'harfbuzzjs*'],
                // Static files never reach `src/server.ts`; the route rules give them the security headers and their cache policy.
                ...(command === 'build' ? { routeRules: routeRules(allowIndexing), compressPublicAssets: { gzip: true, brotli: true } } : {}),
            }),
            viteReact(),
            tailwindcss(),
        ],
    };
});
