import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExportDetails } from '@pkg-guard/core';
import { bundle, compressPart } from './bundle.ts';
import { importableNames, namedEntry, subpathsOf, type Manifest } from './entry.ts';

/** A package can export thousands of names, and one bundle per name is the slow part: enough for any list a person reads. */
const MAX_NAMED = 500;
const MAX_SUBPATHS = 50;
/** How many parts are bundled at once. Rolldown uses threads of its own for each. */
const BATCH = 4;

export type PartsOptions = {
    packageName: string;
    manifest: Manifest;
    dir: string;
    peers: readonly string[];
    /** What the whole package's bundle exports. */
    exportNames: readonly string[];
    esm: boolean;
    /** When to stop starting new bundles (`performance.now()`). What has been measured by then is kept. */
    deadline: number;
};

type Part<T> = { code: string; label: T };

/** Measures parts until they run out or time does. One that cannot be bundled alone is counted and does not stop the rest. */
const measureAll = async <T>(parts: readonly Part<T>[], options: PartsOptions, prefix: string) => {
    const measured: { label: T; minified: number; gzip: number }[] = [];
    let failed = 0;
    for (let start = 0; start < parts.length && performance.now() < options.deadline; start += BATCH) {
        await Promise.all(
            parts.slice(start, start + BATCH).map(async (part, offset) => {
                const file = join(options.dir, `pkg-guard-${prefix}-${start + offset}.mjs`);
                try {
                    await writeFile(file, part.code);
                    const { files } = await bundle(file, options.dir, options.peers);
                    measured.push({ label: part.label, ...(await compressPart(files)) });
                } catch {
                    failed++;
                }
            }),
        );
    }
    return { measured, failed };
};

/** What a package costs part by part. Subpaths come first: there are few of them, and they survive a package with too many names to finish. */
export const measureParts = async (options: PartsOptions): Promise<ExportDetails> => {
    const found = subpathsOf(options.packageName, options.manifest);
    const subpaths = await measureAll(
        found.subpaths.slice(0, MAX_SUBPATHS).map((subpath) => ({ code: subpath.entry.code, label: subpath.path })),
        options,
        'subpath',
    );

    // A bundler cannot drop parts of CommonJS reliably, so a number per name would suggest a saving that is not there.
    const names = options.esm ? importableNames(options.exportNames) : [];
    const named = await measureAll(
        names.slice(0, MAX_NAMED).map((name) => ({ code: namedEntry(options.packageName, name), label: name })),
        options,
        'named',
    );

    return {
        format: options.esm ? 'esm' : 'commonjs',
        sideEffectsFree: options.manifest.sideEffects === false,
        named: named.measured.map(({ label, ...sizes }) => ({ name: label, ...sizes })).sort((a, b) => b.gzip - a.gzip || a.name.localeCompare(b.name)),
        namedTotal: names.length,
        namedFailed: named.failed,
        subpaths: subpaths.measured.map(({ label, ...sizes }) => ({ path: label, ...sizes })).sort((a, b) => a.path.localeCompare(b.path)),
        subpathsTotal: found.subpaths.length,
        subpathsFailed: subpaths.failed,
        subpathPatterns: found.patterns,
    };
};
