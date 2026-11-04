import { describe, expect, it } from 'vitest';
import { createExternal, isFatalUnresolved, type NodeUse } from '@modules/analysis/external.ts';

const setup = (installed: readonly string[] = []) => {
    const use: NodeUse = { builtins: new Set(), nativeAddons: new Set() };
    return { use, external: createExternal({ peers: ['react'], use, isInstalled: (name) => installed.includes(name) }) };
};

describe('createExternal', () => {
    it('keeps out peer dependencies and their subpaths, without noting them', () => {
        const { external, use } = setup();
        expect(external('react')).toBe(true);
        expect(external('react/jsx-runtime')).toBe(true);
        expect(external('react-dom')).toBe(false);
        expect(use.builtins.size + use.nativeAddons.size).toBe(0);
    });

    it('keeps out and notes Node modules', () => {
        const { external, use } = setup();
        expect(external('fs')).toBe(true);
        expect(external('node:path')).toBe(true);
        expect(external('fs/promises')).toBe(true);
        expect([...use.builtins].sort()).toEqual(['fs', 'path']);
    });

    it('bundles an npm package named like a Node module', () => {
        const { external, use } = setup(['events']);
        expect(external('events')).toBe(false);
        expect(use.builtins.size).toBe(0);
        expect(external('node:events')).toBe(true);
    });

    it('keeps out and notes native addons', () => {
        const { external, use } = setup();
        expect(external('./lib/sharp.node')).toBe(true);
        expect(use.nativeAddons.size).toBe(1);
    });

    it('bundles anything else', () => {
        expect(setup().external('lodash')).toBe(false);
    });
});

describe('isFatalUnresolved', () => {
    it('is fatal only when the entry itself cannot find the package', () => {
        expect(isFatalUnresolved("Could not resolve 'zod' in pkg-guard-entry.mjs")).toBe(true);
        expect(isFatalUnresolved("Could not resolve 'critters' in node_modules/next/dist/x.js")).toBe(false);
    });
});
