import { isExactVersion, isValidPackageName, type PackageSuggestion } from '@pkg-guard/core';
import { AppError } from '@platform/errors.ts';

const REGISTRY = 'https://registry.npmjs.org';
const TIMEOUT_MS = 10_000;

const SEARCH_SIZE = 8;
const MAX_DESCRIPTION = 160;

export type VersionResolver = (name: string, versionOrTag: string) => Promise<string>;

export type PackageSearcher = (query: string) => Promise<PackageSuggestion[]>;

/**
 * The exact version behind `latest`, another dist-tag or a version someone typed, from the registry's small document of
 * one version: the document of a whole package can be megabytes. `name` has passed `isValidPackageName`, so it is safe in
 * the path; the slash of a scoped name stays a slash, which is the form the registry answers on this path.
 */
export const resolveFromRegistry: VersionResolver = async (name, versionOrTag) => {
    let response: Response;
    try {
        response = await fetch(`${REGISTRY}/${name}/${encodeURIComponent(versionOrTag)}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
        throw new AppError('UNAVAILABLE', 'The npm registry did not answer');
    }
    if (response.status === 404 || response.status === 405) throw new AppError('NOT_FOUND', `${name}@${versionOrTag} is not on npm`);
    if (!response.ok) throw new AppError('UNAVAILABLE', `The npm registry answered ${response.status}`);
    const manifest = (await response.json()) as { version?: unknown };
    if (typeof manifest.version !== 'string') throw new AppError('UNAVAILABLE', 'The npm registry sent an unexpected answer');
    return manifest.version;
};

const record = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** The registry's answer, in its order, without anything that could not be looked up afterwards. */
export const parseSearch = (answer: unknown): PackageSuggestion[] => {
    const objects = record(answer)['objects'];
    if (!Array.isArray(objects)) return [];
    return objects.flatMap((object): PackageSuggestion[] => {
        const found = record(object);
        const pkg = record(found['package']);
        const { name, version, description } = pkg;
        if (typeof name !== 'string' || typeof version !== 'string' || !isValidPackageName(name) || !isExactVersion(version)) return [];
        const weekly = record(found['downloads'])['weekly'];
        return [
            {
                name,
                version,
                description: typeof description === 'string' && description !== '' ? description.slice(0, MAX_DESCRIPTION) : null,
                weeklyDownloads: typeof weekly === 'number' ? weekly : null,
            },
        ];
    });
};

/** Names and descriptions from the registry's search: no package is downloaded for this. */
export const searchRegistry: PackageSearcher = async (query) => {
    let response: Response;
    try {
        response = await fetch(`${REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${SEARCH_SIZE}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
        throw new AppError('UNAVAILABLE', 'The npm registry did not answer');
    }
    if (!response.ok) throw new AppError('UNAVAILABLE', `The npm registry answered ${response.status}`);
    return parseSearch(await response.json());
};
