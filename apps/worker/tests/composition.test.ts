import { describe, expect, it } from 'vitest';
import { compositionOf } from '@modules/analysis/composition.ts';

describe('compositionOf', () => {
    it('divides a bundle between packages, largest first', () => {
        const { packages, total } = compositionOf([
            ['/work/node_modules/@tanstack/query-core/build/a.js', 60],
            ['/work/node_modules/@tanstack/query-core/build/b.js', 15],
            ['/work/node_modules/@tanstack/react-query/index.js', 25],
        ]);
        expect(total).toBe(2);
        expect(packages).toEqual([
            { name: '@tanstack/query-core', share: 0.75, modules: 2 },
            { name: '@tanstack/react-query', share: 0.25, modules: 1 },
        ]);
    });

    it('credits a nested dependency to itself, not to the package around it', () => {
        expect(compositionOf([['/work/node_modules/a/node_modules/b/index.js', 10]]).packages[0]?.name).toBe('b');
    });

    it('leaves out the entry, the runtime and what tree-shaking emptied', () => {
        const { packages } = compositionOf([
            ['/work/weighme-entry.mjs', 50],
            ['\0rolldown/runtime.js', 50],
            ['/work/node_modules/gone/index.js', 0],
            ['/work/node_modules/kept/index.js', 10],
        ]);
        expect(packages).toEqual([{ name: 'kept', share: 1, modules: 1 }]);
    });

    it('caps the list but still counts every package', () => {
        const modules = Array.from({ length: 40 }, (_, index) => [`/work/node_modules/p${index}/index.js`, index + 1] as const);
        const { packages, total } = compositionOf(modules);
        expect(total).toBe(40);
        expect(packages).toHaveLength(30);
        expect(packages[0]?.name).toBe('p39');
    });

    it('is empty for an empty bundle', () => {
        expect(compositionOf([])).toEqual({ packages: [], total: 0 });
    });
});
