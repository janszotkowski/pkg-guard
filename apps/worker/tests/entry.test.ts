import { describe, expect, it } from 'vitest';
import { commandsOf, entrySource, importableNames, isEsm, namedEntry, peerNames, subpathsOf } from '@modules/analysis/entry.ts';
import { toFailure, AnalysisError } from '@modules/analysis/failure.ts';

describe('isEsm', () => {
    it.each([
        [{ type: 'module' }, true],
        [{ module: 'index.esm.js' }, true],
        [{ exports: { '.': { import: './index.mjs', require: './index.cjs' } } }, true],
        [{ exports: { '.': [{ import: './index.mjs' }] } }, true],
        [{ exports: './index.js' }, false],
        [{ type: 'commonjs' }, false],
        [{}, false],
    ])('reads %j', (manifest, expected) => {
        expect(isEsm(manifest)).toBe(expected);
    });
});

describe('entrySource', () => {
    it('keeps tree-shaking for ES modules', () => {
        expect(entrySource('x', { type: 'module' })).toEqual({ kind: 'export-star', code: 'export * from "x";\n' });
    });

    it('keeps the namespace of CommonJS alive', () => {
        const entry = entrySource('x', {});
        expect(entry.kind).toBe('namespace');
        expect(entry.code).toContain('import * as all from "x"');
    });
});

describe('commandsOf', () => {
    it('reads both forms of bin', () => {
        expect(commandsOf('pnpm', { bin: { pnpm: 'pnpm', pnpx: 'pnpx' } })).toEqual(['pnpm', 'pnpx']);
        expect(commandsOf('@scope/tool', { bin: './cli.js' })).toEqual(['tool']);
    });

    it('finds none in a package without commands, and leaves out what is not a name', () => {
        expect(commandsOf('x', {})).toEqual([]);
        expect(commandsOf('x', { bin: { ok: 'a', 'not a name; run': 'b' } })).toEqual(['ok']);
    });
});

describe('importableNames', () => {
    it('keeps plain names once, in order, and nothing that could not be imported by name', () => {
        expect(importableNames(['b', 'a', 'a', 'default', 'not valid', '$c', '1x', 'x"; run();'])).toEqual(['$c', 'a', 'b']);
    });
});

describe('namedEntry', () => {
    it('imports one export alone', () => {
        expect(namedEntry('@scope/x', 'add')).toBe('export { add } from "@scope/x";\n');
    });
});

describe('subpathsOf', () => {
    it('finds the paths that lead to code', () => {
        const { subpaths, patterns } = subpathsOf('x', {
            exports: {
                '.': './index.js',
                './client': { types: './client.d.ts', import: './client.mjs', require: './client.cjs' },
                './legacy': './legacy.cjs',
                './style.css': './style.css',
                './package.json': './package.json',
                './types': { types: './types.d.ts' },
                './plugins/*': './plugins/*.js',
                './none': null,
            },
        });
        expect(patterns).toBe(1);
        expect(subpaths.map((subpath) => [subpath.path, subpath.entry.kind])).toEqual([
            ['./client', 'export-star'],
            ['./legacy', 'namespace'],
        ]);
        expect(subpaths[0]?.entry.code).toBe('export * from "x/client";\n');
    });

    it('finds nothing in a package without a map of paths', () => {
        expect(subpathsOf('x', { exports: './index.js' })).toEqual({ subpaths: [], patterns: 0 });
        expect(subpathsOf('x', { exports: { import: './index.mjs' } })).toEqual({ subpaths: [], patterns: 0 });
        expect(subpathsOf('x', {})).toEqual({ subpaths: [], patterns: 0 });
    });
});

describe('peerNames', () => {
    it('reads the names, and nothing from a malformed field', () => {
        expect(peerNames({ peerDependencies: { react: '*', 'react-dom': '*' } })).toEqual(['react', 'react-dom']);
        expect(peerNames({ peerDependencies: 'react' })).toEqual([]);
    });
});

describe('toFailure', () => {
    it('removes local paths and keeps the code', () => {
        expect(toFailure(new AnalysisError('BUNDLE_FAILED', 'cannot read /work/job/x.js'), '/work/job')).toEqual({ code: 'BUNDLE_FAILED', message: 'cannot read x.js' });
    });

    it('removes terminal colors and the real form of a linked folder', () => {
        expect(toFailure(new AnalysisError('BUNDLE_FAILED', '\u001b[31mcannot load\u001b[0m /private/var/job/node_modules/x.node'), '/var/job').message).toBe('cannot load node_modules/x.node');
    });

    it('calls anything else internal', () => {
        expect(toFailure(new Error(''), '/work').code).toBe('INTERNAL');
    });
});
