import { TREND_RANGES, parseSpec, type TrendRange } from '@pkg-guard/core';

export const MAX_TREND_PACKAGES = 4;

/** What the page opens with when the address names no packages. */
export const DEFAULT_TREND_PACKAGES = ['react', 'vue'] as const;

export const TREND_METRICS = ['size', 'downloads'] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

export const TREND_GROUPS = ['day', 'week', 'month'] as const;
export type TrendGroup = (typeof TREND_GROUPS)[number];

/** Everything the page shows is in its address, so a link opens the same view. */
export type TrendsSearch = { packages?: string; metric?: TrendMetric; range?: TrendRange; group?: TrendGroup };

export type TrendsView = { packages: string[]; metric: TrendMetric; range: TrendRange; group: TrendGroup };

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | undefined => allowed.find((candidate) => candidate === value);

/** A package once by its name: a version means nothing to a trend. What cannot be a package is left out, and what is past the limit. */
export const parsePackages = (value: unknown): string[] => {
    if (typeof value !== 'string') return [];
    const names = value.split(',').flatMap((part) => parseSpec(part)?.name ?? []);
    return [...new Set(names)].slice(0, MAX_TREND_PACKAGES);
};

/** What the address may say; anything else is dropped rather than refused. Defaults stay out of the address. */
export const validateTrendsSearch = (search: Record<string, unknown>): TrendsSearch => {
    const named = search['packages'];
    const packages = parsePackages(named);
    const metric = oneOf(TREND_METRICS, search['metric']);
    const range = oneOf(TREND_RANGES, search['range']);
    const group = oneOf(TREND_GROUPS, search['group']);
    return {
        // An empty list is a choice, made by removing every package: only no list at all means the defaults.
        ...(typeof named === 'string' ? { packages: packages.join(',') } : {}),
        ...(metric === undefined || metric === 'size' ? {} : { metric }),
        ...(range === undefined || range === '1y' ? {} : { range }),
        ...(group === undefined || group === 'week' ? {} : { group }),
    };
};

export const trendsView = (search: TrendsSearch): TrendsView => ({
    packages: search.packages === undefined ? [...DEFAULT_TREND_PACKAGES] : parsePackages(search.packages),
    metric: search.metric ?? 'size',
    range: search.range ?? '1y',
    group: search.group ?? 'week',
});

const DAY_MS = 86_400_000;

const mondayOf = (time: number): number => {
    const weekday = (new Date(time).getUTCDay() + 6) % 7;
    return time - weekday * DAY_MS;
};

const monthOf = (time: number): number => {
    const date = new Date(time);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

const daysInMonth = (time: number): number => {
    const date = new Date(time);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

export type TrendPoint = { time: number; value: number };

/**
 * Downloads per day, week or month. A week or a month the range only partly covers is left out: its smaller sum would look
 * like a fall in downloads. Today is left out for the same reason, since it has barely been counted.
 */
export const groupDownloads = (days: readonly { day: string; downloads: number }[], group: TrendGroup, today: string): TrendPoint[] => {
    const complete = days.filter((row) => row.day < today);
    if (group === 'day') return complete.map((row) => ({ time: Date.parse(row.day), value: row.downloads }));
    const buckets = new Map<number, { value: number; count: number }>();
    for (const row of complete) {
        const time = Date.parse(row.day);
        const key = group === 'week' ? mondayOf(time) : monthOf(time);
        const bucket = buckets.get(key) ?? { value: 0, count: 0 };
        bucket.value += row.downloads;
        bucket.count += 1;
        buckets.set(key, bucket);
    }
    return [...buckets]
        .filter(([key, bucket]) => bucket.count === (group === 'week' ? 7 : daysInMonth(key)))
        .map(([time, bucket]) => ({ time, value: bucket.value }))
        .sort((a, b) => a.time - b.time);
};

/** Downloads over the last seven full days. */
export const weeklyDownloads = (days: readonly { day: string; downloads: number }[], today: string): number | undefined => {
    const complete = days.filter((row) => row.day < today);
    return complete.length < 7 ? undefined : complete.slice(-7).reduce((sum, row) => sum + row.downloads, 0);
};

const REPOSITORY = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/;

/** `owner/name` of a package's GitHub page, which may lead into a folder of a monorepo. */
export const repositoryOf = (url: string | null | undefined): string | undefined => (url === null || url === undefined ? undefined : REPOSITORY.exec(url)?.[1]);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const monthLabel = (time: number): string => {
    const date = new Date(time);
    return `${MONTHS[date.getUTCMonth()] ?? ''} ’${String(date.getUTCFullYear()).slice(2)}`;
};

export const dayLabel = (time: number): string => {
    const date = new Date(time);
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ''} ${date.getUTCFullYear()}`;
};

/** First days of months across a span, with as many as the width has room for. */
export const monthTicks = (from: number, to: number, width: number): number[] => {
    const first = new Date(monthOf(from));
    const months: number[] = [];
    for (let month = 0; ; month++) {
        const time = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + month, 1);
        if (time > to) break;
        if (time >= from) months.push(time);
    }
    const room = Math.max(2, Math.floor(width / 80));
    const step = [1, 2, 3, 4, 6, 12, 24, 36, 60].find((candidate) => months.length / candidate <= room) ?? 120;
    return months.filter((_, index) => index % step === 0);
};
