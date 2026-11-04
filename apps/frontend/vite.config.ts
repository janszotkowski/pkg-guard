import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig, loadEnv } from 'vite';

import { dropUseClientDirectiveWarning } from './vite/logs.ts';
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

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    if (command === 'build') requireApiUrl(env);
    const allowIndexing = env['VITE_ALLOW_INDEXING'] === 'true';
    return {
        server: { port: 3100 },
        resolve: { tsconfigPaths: true },
        plugins: [
            tanstackStart(),
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
