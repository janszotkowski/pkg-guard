import { defineConfig } from 'oxlint';

export default defineConfig({
    ignorePatterns: ['dist', 'build', '.output', 'node_modules', '.tanstack', '.turbo', '**/routeTree.gen.ts'],
    plugins: ['import', 'unicorn', 'typescript'],
    categories: {
        correctness: 'warn',
    },
    rules: {
        'eslint/no-unused-vars': 'error',
        'eslint/no-console': ['error', { allow: ['warn', 'error'] }],
        '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-empty-object-type': 'error',
        '@typescript-eslint/no-empty-interface': 'error',
        '@typescript-eslint/no-empty-function': 'error',
        // Every function is a const: `export const parseSpec = () => {}`, never `export function parseSpec() {}`.
        'eslint/func-style': ['error', 'expression'],
        // Imports use the path aliases of the package (@platform/…, @lib/…): no `../` and no `./folder/…`.
        // Only a sibling in the same folder (`./name`) may be relative.
        'eslint/no-restricted-imports': [
            'error',
            { patterns: [{ group: ['../**', './*/**'], message: 'Use a path alias (@platform/…, @lib/…). Only same-folder siblings (./name) may be relative.' }] },
        ],
    },
    overrides: [
        {
            // core is shared with the browser and Node, so browser- and Node-specific globals must never creep in.
            files: ['packages/core/src/**'],
            rules: {
                'eslint/no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'process', 'Buffer'],
            },
        },
        {
            // Code that runs before aliases exist, and `core`, which other packages consume as source.
            files: ['**/vite.config.ts', '**/vitest.config.ts', '**/tsdown.config.ts', 'apps/frontend/vite/**', 'packages/core/src/**'],
            rules: { 'eslint/no-restricted-imports': 'off' },
        },
        {
            // core's schemas reach the browser: zod/mini tree-shakes, the classic API pulls all of zod into the client.
            files: ['packages/core/src/**'],
            rules: {
                'eslint/no-restricted-imports': ['error', { paths: [{ name: 'zod', message: 'Use zod/mini: core ships to the browser.' }] }],
            },
        },
        {
            // React and a11y rules for the frontend only.
            files: ['apps/frontend/**/*.ts', 'apps/frontend/**/*.tsx'],
            plugins: ['react', 'jsx-a11y'],
            jsPlugins: ['./tools/oxlint-plugin.js'],
            rules: {
                'weighme/no-destructured-component-props': 'error',
                'weighme/no-inline-component-props-type': 'error',
                'react/jsx-curly-brace-presence': [
                    'error',
                    {
                        props: 'always',
                        children: 'never',
                    },
                ],
            },
        },
    ],
});
