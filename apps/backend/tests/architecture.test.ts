import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The module rules from the architecture, enforced: modules do not import each
 * other, `platform` and `config` do not know any module, and only the composition
 * root wires modules together. A violation fails here, not in review.
 */

const SRC = resolve(import.meta.dirname, '../src');

const files = (directory: string): string[] => {
    return readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
    });
};

/** Path aliases of this package (tsconfig `paths`), as absolute directories. */
const ALIASES: Record<string, string> = {
    '@config': resolve(SRC, 'config'),
    '@platform': resolve(SRC, 'platform'),
    '@modules': resolve(SRC, 'modules'),
    '@composition': resolve(SRC, 'composition'),
    '@src': SRC,
};

/** Every import specifier: `import … from`, `export … from`, a side-effect `import '…'` and a dynamic `import('…')`. */
const specifiersIn = (source: string): string[] => [...source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');

const specifiersOf = (file: string): string[] => specifiersIn(readFileSync(file, 'utf8'));

const importsOf = (file: string): string[] => {
    return specifiersOf(file).flatMap((specifier) => {
        if (specifier.startsWith('.')) return [resolve(file, '..', specifier)];
        const [alias, ...rest] = specifier.split('/');
        const directory = alias === undefined ? undefined : ALIASES[alias];
        return directory === undefined ? [] : [join(directory, ...rest)];
    });
};

const moduleOf = (path: string): string | undefined => {
    const [first, name] = relative(SRC, path).split('/');
    return first === 'modules' ? name : undefined;
};

describe('backend module boundaries', () => {
    const all = files(SRC);

    it('finds the source files', () => {
        expect(all.length).toBeGreaterThan(10);
    });

    it('never lets a module import another module', () => {
        const violations: string[] = [];
        for (const file of all) {
            const own = moduleOf(file);
            if (own === undefined) continue;
            for (const target of importsOf(file)) {
                const other = moduleOf(target);
                if (other !== undefined && other !== own) violations.push(`${relative(SRC, file)} → ${relative(SRC, target)}`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('never lets platform or config import a module or the composition root', () => {
        const violations: string[] = [];
        for (const file of all) {
            const [layer] = relative(SRC, file).split('/');
            if (layer !== 'platform' && layer !== 'config') continue;
            for (const target of importsOf(file)) {
                const [targetLayer] = relative(SRC, target).split('/');
                if (targetLayer === 'modules' || targetLayer === 'composition') violations.push(`${relative(SRC, file)} → ${relative(SRC, target)}`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('resolves every alias the backend uses', () => {
        const aliases = Object.keys(ALIASES).sort();
        const tsconfig = JSON.parse(readFileSync(resolve(SRC, '../tsconfig.json'), 'utf8')) as { compilerOptions: { paths: Record<string, string[]> } };
        const configured = Object.keys(tsconfig.compilerOptions.paths)
            .map((key) => key.replace('/*', ''))
            .filter((key) => key !== '@tests');
        expect(configured.sort()).toEqual(aliases);
    });

    it('keeps application code free of HTTP and infrastructure details', () => {
        const violations: string[] = [];
        for (const file of all) {
            if (!relative(SRC, file).split('/').includes('application')) continue;
            for (const specifier of specifiersOf(file)) if (/^@?hono(\/|$)/.test(specifier)) violations.push(`${relative(SRC, file)} → ${specifier}`);
            for (const target of importsOf(file)) {
                const layers = relative(SRC, target).split('/');
                if (layers.includes('infrastructure') || layers.includes('http')) violations.push(`${relative(SRC, file)} → ${relative(SRC, target)}`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('reads every kind of import', () => {
        const source = [
            "import { a } from '@platform/a.ts';",
            'import type { B } from "@platform/b.ts";',
            "export { c } from './c.ts';",
            "import '@modules/x/infrastructure/side-effect.ts';",
            "const d = await import('@modules/x/infrastructure/dynamic.ts');",
            "const e = await import ( './e.ts' );",
        ].join('\n');
        expect(specifiersIn(source)).toEqual(['@platform/a.ts', '@platform/b.ts', './c.ts', '@modules/x/infrastructure/side-effect.ts', '@modules/x/infrastructure/dynamic.ts', './e.ts']);
    });
});
