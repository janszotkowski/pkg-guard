import { describe, expect, it } from 'vitest';
import { entrySource, isEsm, peerNames } from '@modules/analysis/entry.ts';
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

describe('peerNames', () => {
    it('reads the names, and nothing from a malformed field', () => {
        expect(peerNames({ peerDependencies: { react: '*', 'react-dom': '*' } })).toEqual(['react', 'react-dom']);
        expect(peerNames({ peerDependencies: 'react' })).toEqual([]);
    });
});

describe('toFailure', () => {
    it('removes local paths and keeps the code', () => {
        expect(toFailure(new AnalysisError('BUNDLE_FAILED', 'cannot read /work/job/x.js'), '/work/job')).toEqual({ code: 'BUNDLE_FAILED', message: 'cannot read /x.js' });
    });

    it('calls anything else internal', () => {
        expect(toFailure(new Error(''), '/work').code).toBe('INTERNAL');
    });
});
