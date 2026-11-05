import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/main.cli.ts'],
    format: 'esm',
    platform: 'node',
    target: 'node24',
    outDir: 'dist',
    clean: true,
    tsconfig: 'tsconfig.json',
    // The workspace package core is imported from source, so it is bundled in.
    deps: { alwaysBundle: [/^@pkg-guard\//] },
});
