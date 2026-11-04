import { TREND_RANGE_DAYS, isExactVersion, isValidPackageName, type DownloadsResponse, type PackageSuggestion, type TrendRange } from '@pkg-guard/core';
import { rangeChunks } from '@modules/analyses/application/download-ranges.ts';
import { selectVersions } from '@modules/analyses/application/versions.ts';
import { AppError } from '@platform/errors.ts';

const REGISTRY = 'https://registry.npmjs.org';
const TIMEOUT_MS = 10_000;

const SEARCH_SIZE = 8;
const MAX_DESCRIPTION = 160;

export type VersionResolver = (name: string, versionOrTag: string) => Promise<string>;

export type PackageSearcher = (query: string) => Promise<PackageSuggestion[]>;

export type ReleasedVersion = { version: string; publishedAt: string | null };

export type VersionLister = (name: string) => Promise<ReleasedVersion[]>;

export type DownloadsReader = (name: string, range: TrendRange) => Promise<DownloadsResponse['days']>;

export type StarsReader = (repository: string) => Promise<number | null>;

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

const FULL_DOCUMENT_TIMEOUT_MS = 30_000;
const VERSIONS_TTL_MS = 10 * 60_000;
const VERSIONS_MAX_CACHED = 500;

/**
 * The releases worth showing for a package, with their dates. Only the registry's full document has the dates, and it runs
 * to tens of megabytes for a popular package, so only the pick is kept, for a while.
 */
export const createVersionLister = (now: () => number = Date.now): VersionLister => {
    const cache = new Map<string, { versions: ReleasedVersion[]; until: number }>();
    return async (name) => {
        const cached = cache.get(name);
        if (cached !== undefined && now() < cached.until) return cached.versions;
        let response: Response;
        try {
            response = await fetch(`${REGISTRY}/${name}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(FULL_DOCUMENT_TIMEOUT_MS) });
        } catch {
            throw new AppError('UNAVAILABLE', 'The npm registry did not answer');
        }
        if (response.status === 404 || response.status === 405) throw new AppError('NOT_FOUND', `${name} is not on npm`);
        if (!response.ok) throw new AppError('UNAVAILABLE', `The npm registry answered ${response.status}`);
        const document = record(await response.json());
        const latest = record(document['dist-tags'])['latest'];
        const time = record(document['time']);
        const versions = (
            typeof latest === 'string'
                ? selectVersions(Object.keys(record(document['versions'])), latest, (version) => {
                      const date = time[version];
                      return typeof date === 'string' ? date : undefined;
                  })
                : []
        ).map((version) => {
            const publishedAt = time[version];
            return { version, publishedAt: typeof publishedAt === 'string' ? publishedAt : null };
        });
        if (cache.size >= VERSIONS_MAX_CACHED) cache.clear();
        cache.set(name, { versions, until: now() + VERSIONS_TTL_MS });
        return versions;
    };
};

const DOWNLOADS_API = 'https://api.npmjs.org/downloads/range';
const HOUR_MS = 3_600_000;
const CACHE_MAX = 500;

/** A small cache for what an outside service would rather not be asked often. */
const remember = <T>(now: () => number, ttlMs: number) => {
    const cache = new Map<string, { value: T; until: number }>();
    return {
        get: (key: string): T | undefined => {
            const entry = cache.get(key);
            return entry !== undefined && now() < entry.until ? entry.value : undefined;
        },
        set: (key: string, value: T, ttl = ttlMs): void => {
            if (cache.size >= CACHE_MAX) cache.clear();
            cache.set(key, { value, until: now() + ttl });
        },
    };
};

/** A package's downloads per day from npm's own statistics. npm updates them once a day. */
export const createDownloadsReader = (now: () => number = Date.now): DownloadsReader => {
    const cache = remember<DownloadsResponse['days']>(now, HOUR_MS);
    return async (name, range) => {
        const key = `${range}:${name}`;
        const cached = cache.get(key);
        if (cached !== undefined) return cached;
        const parts = await Promise.all(
            rangeChunks(new Date(now()), TREND_RANGE_DAYS[range]).map(async (chunk) => {
                let response: Response;
                try {
                    response = await fetch(`${DOWNLOADS_API}/${chunk.start}:${chunk.end}/${name}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
                } catch {
                    throw new AppError('UNAVAILABLE', 'npm did not answer');
                }
                // npm answers 404 for a period before the package existed: that is no downloads, not a failure.
                if (response.status === 404) return [];
                if (!response.ok) throw new AppError('UNAVAILABLE', `npm answered ${response.status}`);
                const rows = record(await response.json())['downloads'];
                return Array.isArray(rows)
                    ? rows.flatMap((row) => {
                          const { day, downloads } = record(row);
                          return typeof day === 'string' && typeof downloads === 'number' ? [{ day, downloads }] : [];
                      })
                    : [];
            }),
        );
        const days = parts.flat();
        cache.set(key, days);
        return days;
    };
};

const STARS_TTL_MS = 6 * HOUR_MS;
const STARS_RETRY_MS = 10 * 60_000;

/**
 * A repository's stars from GitHub, kept for hours: without a token GitHub allows 60 questions an hour. Failing costs only
 * the number, so it answers null, and is not asked again for a while.
 */
export const createStarsReader = (token: string | undefined, now: () => number = Date.now): StarsReader => {
    const cache = remember<{ stars: number | null }>(now, STARS_TTL_MS);
    return async (repository) => {
        const cached = cache.get(repository);
        if (cached !== undefined) return cached.stars;
        try {
            const response = await fetch(`https://api.github.com/repos/${repository}`, {
                headers: { accept: 'application/vnd.github+json', 'user-agent': 'pkg-guard', ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) },
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            const stars = response.ok ? record(await response.json())['stargazers_count'] : undefined;
            if (typeof stars === 'number') {
                cache.set(repository, { stars });
                return stars;
            }
        } catch {
            // Handled below, as any other answer without a number.
        }
        cache.set(repository, { stars: null }, STARS_RETRY_MS);
        return null;
    };
};
