import type { AnalysisResult } from '@weighme/core';

/** Enough for any list a person reads: the rest is shown as one line. */
const MAX_PACKAGES = 30;

/** The last `node_modules` in a path is the package the file belongs to, however deeply packages are nested. */
const OWNER = /.*node_modules\/((?:@[^/]+\/)?[^/]+)/;

/**
 * How a bundle divides between the packages in it. The lengths are measured before minifying, so only the shares mean
 * anything; the page turns them into an estimate. Modules outside `node_modules`, such as the bundler's own runtime and
 * the entry, and modules tree-shaking emptied, count for nothing.
 */
export const compositionOf = (modules: readonly (readonly [string, number])[]): AnalysisResult['composition'] => {
    const owners = new Map<string, { length: number; modules: number }>();
    let total = 0;
    for (const [id, length] of modules) {
        const name = OWNER.exec(id)?.[1];
        if (name === undefined || length <= 0) continue;
        const owner = owners.get(name) ?? { length: 0, modules: 0 };
        owner.length += length;
        owner.modules += 1;
        owners.set(name, owner);
        total += length;
    }
    const packages = [...owners].map(([name, owner]) => ({ name, share: owner.length / total, modules: owner.modules })).sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
    return { packages: packages.slice(0, MAX_PACKAGES), total: packages.length };
};
