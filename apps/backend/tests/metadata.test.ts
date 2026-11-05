import { describe, expect, it } from 'vitest';
import { definitelyTypedName, parseVersionFacts } from '@modules/analyses/infrastructure/registry.ts';

describe('parseVersionFacts', () => {
    it('reads what a version says of itself', () => {
        const facts = parseVersionFacts({ deprecated: 'Use y instead', license: 'MIT', types: './index.d.ts', scripts: { test: 'vitest', postinstall: 'node setup.js' } });
        expect(facts).toEqual({ deprecated: 'Use y instead', license: 'MIT', typesIncluded: true, installScripts: ['postinstall'] });
    });

    it('takes an empty deprecation as taken back', () => {
        expect(parseVersionFacts({ deprecated: '' }).deprecated).toBeNull();
        expect(parseVersionFacts({ deprecated: true }).deprecated).toBe('This version is deprecated.');
        expect(parseVersionFacts({}).deprecated).toBeNull();
    });

    it('reads the old forms of a licence', () => {
        expect(parseVersionFacts({ license: { type: 'ISC' } }).license).toBe('ISC');
        expect(parseVersionFacts({ licenses: [{ type: 'BSD-3-Clause' }] }).license).toBe('BSD-3-Clause');
        expect(parseVersionFacts({ license: '' }).license).toBeNull();
    });

    it('finds types declared in exports', () => {
        expect(parseVersionFacts({ exports: { '.': { import: { types: './a.d.ts', default: './a.js' } } } }).typesIncluded).toBe(true);
        expect(parseVersionFacts({ exports: { '.': './a.js' } }).typesIncluded).toBe(false);
    });

    it('counts a native build as something that runs on install, once', () => {
        expect(parseVersionFacts({ gypfile: true }).installScripts).toEqual(['node-gyp']);
        expect(parseVersionFacts({ gypfile: true, scripts: { install: 'node-gyp rebuild' } }).installScripts).toEqual(['install']);
        expect(parseVersionFacts({ scripts: { prepare: 'tsc' } }).installScripts).toEqual([]);
    });

    it('caps a long message and survives an unexpected answer', () => {
        expect(parseVersionFacts({ deprecated: 'a'.repeat(900) }).deprecated?.length).toBeLessThanOrEqual(500);
        expect(parseVersionFacts(null)).toEqual({ deprecated: null, license: null, typesIncluded: false, installScripts: [] });
    });
});

describe('definitelyTypedName', () => {
    it('follows the naming of DefinitelyTyped', () => {
        expect(definitelyTypedName('react')).toBe('@types/react');
        expect(definitelyTypedName('@babel/core')).toBe('@types/babel__core');
    });
});
