import { defineConfig } from 'oxfmt';

export default defineConfig({
    printWidth: 200,
    singleQuote: true,
    trailingComma: 'all',
    arrowParens: 'always',
    bracketSpacing: true,
    bracketSameLine: false,
    tabWidth: 4,
    singleAttributePerLine: true,
    ignorePatterns: ['dist', 'build', '.output', 'node_modules', '.tanstack', '.turbo', '**/routeTree.gen.ts', 'docs', '.claude', 'pnpm-lock.yaml'],
});
