import { defineConfig } from 'tsdown';

export default defineConfig({
    // One analysis runs in its own process, started from `main.analyze.mjs` next to the worker.
    entry: ['src/main.worker.ts', 'src/main.analyze.ts'],
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outDir: 'dist',
    clean: true,
    tsconfig: 'tsconfig.json',
    // The workspace package core is imported from source, so it is bundled in.
    deps: { alwaysBundle: [/^@weighme\//] },
});
