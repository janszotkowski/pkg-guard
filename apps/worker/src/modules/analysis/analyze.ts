import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalysisResult, PackageRef } from '@pkg-guard/core';
import { BUNDLER, bundle, compress } from './bundle.ts';
import { entrySource, peerNames, type Manifest } from './entry.ts';
import { AnalysisError } from './failure.ts';
import { installPackage, measureInstall } from './install.ts';

export type AnalyzeOptions = { dir: string; storeDir: string; maxInstallBytes: number };

const elapsed = (from: number): number => Math.round(performance.now() - from);

/** One package from nothing to its numbers. The package's code is read, never run. */
export const analyze = async (ref: PackageRef, options: AnalyzeOptions): Promise<AnalysisResult> => {
    const installStarted = performance.now();
    await installPackage(ref, options.dir, options.storeDir);
    const install = await measureInstall(options.dir, options.maxInstallBytes);
    const installMs = elapsed(installStarted);

    let manifest: Manifest;
    try {
        manifest = JSON.parse(await readFile(join(options.dir, 'node_modules', ref.name, 'package.json'), 'utf8')) as Manifest;
    } catch {
        throw new AnalysisError('INSTALL_FAILED', 'The package has no readable package.json');
    }
    const entry = entrySource(ref.name, manifest);
    const peerDependencies = peerNames(manifest);
    const entryFile = join(options.dir, 'pkg-guard-entry.mjs');
    await writeFile(entryFile, entry.code);

    const bundleStarted = performance.now();
    const files = await bundle(entryFile, options.dir, peerDependencies);
    const bundleMs = elapsed(bundleStarted);

    const compressStarted = performance.now();
    const sizes = await compress(files);
    const compressMs = elapsed(compressStarted);

    return { bundler: BUNDLER, entry: entry.kind, sizes, install, peerDependencies, timingsMs: { install: installMs, bundle: bundleMs, compress: compressMs } };
};
