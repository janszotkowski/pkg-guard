import { AppError } from '@platform/errors.ts';

const REGISTRY = 'https://registry.npmjs.org';
const TIMEOUT_MS = 10_000;

export type VersionResolver = (name: string, versionOrTag: string) => Promise<string>;

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
