const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;
const MAX_VERSIONS = 10;

type Parsed = { version: string; major: number; minor: number; patch: number };

const parse = (version: string): Parsed | undefined => {
    const match = STABLE.exec(version);
    if (match === null) return undefined;
    return { version, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
};

const newestFirst = (a: Parsed, b: Parsed): number => b.major - a.major || b.minor - a.minor || b.patch - a.patch;

/**
 * Which releases tell a package's story over time: `latest`, then the first release of each minor, when that minor's size
 * first reached people. A later patch of an old minor says little, and many come out on one day across every maintained
 * line, which would stack them at one date. A package with few minors shows its patches too, so that the list is not
 * nearly empty. Going back from `latest`, a release dated after the one kept before it is a backport to an older line,
 * and is left out, because a history has one line through time. Prereleases say little about what people install.
 */
export const selectVersions = (versions: readonly string[], latest: string, publishedAt: (version: string) => string | undefined): string[] => {
    const top = parse(latest);
    if (top === undefined) return [];
    const stable = versions
        .flatMap((version) => parse(version) ?? [])
        .filter((candidate) => newestFirst(top, candidate) <= 0)
        .sort(newestFirst);

    const firstOfMinor = new Map<string, string>();
    for (const candidate of stable) firstOfMinor.set(`${candidate.major}.${candidate.minor}`, candidate.version);
    const picked = new Set([latest, ...firstOfMinor.values()]);
    for (const candidate of stable) {
        if (picked.size >= MAX_VERSIONS) break;
        picked.add(candidate.version);
    }

    const kept: string[] = [];
    let earliest = Number.POSITIVE_INFINITY;
    for (const candidate of stable) {
        if (kept.length === MAX_VERSIONS) break;
        if (!picked.has(candidate.version)) continue;
        const date = Date.parse(publishedAt(candidate.version) ?? '');
        if (Number.isFinite(date)) {
            if (date > earliest) continue;
            earliest = date;
        }
        kept.push(candidate.version);
    }
    return kept;
};
