import { parseSpec, type AnalysisResponse, type HistoryResponse, type TrendRange } from '@pkg-guard/core';
import { keepPreviousData, useQueries } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Check, Link2, LoaderCircle, X } from 'lucide-react';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { IsoPackage } from '@components/iso/IsoPackage';
import { PackageSearch } from '@components/PackageSearch';
import { SegmentedControl } from '@components/SegmentedControl';
import { TrendsChart, type TrendRow } from '@components/TrendsChart';
import { TrendsTable, type TrendsTableRow } from '@components/TrendsTable';
import { Button } from '@components/ui/button';
import { siteConfig } from '@config/site';
import { pageHead } from '@lib/head';
import { ApiError, analysisQuery, downloadsQuery, historyQuery, starsQuery } from '@lib/api';
import { useMeasureOnce } from '@lib/useMeasureOnce';
import { formatCount, formatSizeText } from '@lib/format';
import { MAX_TREND_PACKAGES, groupDownloads, parsePackages, repositoryOf, trendsView, validateTrendsSearch, weeklyDownloads, type TrendGroup, type TrendMetric, type TrendsSearch } from '@lib/trends';

const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'] as const;

const METRICS: readonly { value: TrendMetric; label: string }[] = [
    { value: 'size', label: 'Size' },
    { value: 'downloads', label: 'Downloads' },
];
const RANGES: readonly { value: TrendRange; label: string }[] = [
    { value: '2m', label: '2M' },
    { value: '1y', label: '1Y' },
    { value: '3y', label: '3Y' },
];
const GROUPS: readonly { value: TrendGroup; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
];

const today = (): string => new Date().toISOString().slice(0, 10);

/** A color stays with its package when others are removed; a new package takes the first color nobody has. */
const assignColors = (packages: readonly string[], previous: ReadonlyMap<string, string>): ReadonlyMap<string, string> => {
    const next = new Map([...previous].filter(([name]) => packages.includes(name)));
    for (const name of packages) {
        if (next.has(name)) continue;
        const taken = new Set(next.values());
        next.set(name, SERIES_COLORS.find((color) => !taken.has(color)) ?? SERIES_COLORS[0]);
    }
    return next;
};

/** Removing one package must not repaint the others, so the colors outlive a change of the list while the page is open. */
const useSeriesColors = (packages: readonly string[]): ReadonlyMap<string, string> => {
    const [colors, setColors] = useState<ReadonlyMap<string, string>>(() => assignColors(packages, new Map()));
    const key = packages.join();
    const [seenKey, setSeenKey] = useState(key);
    if (key === seenKey) return colors;
    const next = assignColors(packages, colors);
    setSeenKey(key);
    setColors(next);
    return next;
};

const stateOf = (data: AnalysisResponse | undefined, error: unknown): string | undefined => {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') return 'Not on npm';
    if (error !== null && error !== undefined) return 'Could not be loaded';
    if (data === undefined || data.status === 'queued' || data.status === 'running') return 'Measuring…';
    if (data.status === 'failed') return 'Could not be measured';
    return data.result.sizes === null ? 'Nothing to import' : undefined;
};

const sizeRows = (histories: readonly (HistoryResponse | undefined)[]): TrendRow[] =>
    histories
        .flatMap((history) =>
            (history?.versions ?? []).flatMap((entry): TrendRow[] =>
                entry.gzip === null || entry.publishedAt === null ? [] : [{ name: history?.name ?? '', time: Date.parse(entry.publishedAt), value: entry.gzip, detail: entry.version }],
            ),
        )
        .sort((a, b) => a.time - b.time);

const CopyLink = () => {
    const [copied, setCopied] = useState(false);
    const Icon = copied ? Check : Link2;
    return (
        <Button
            variant={'secondary'}
            onClick={() => {
                void navigator.clipboard.writeText(location.href).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                });
            }}
        >
            <Icon
                aria-hidden={'true'}
                className={'size-4'}
            />
            {copied ? 'Copied' : 'Copy link'}
        </Button>
    );
};

const TrendsPage = () => {
    const search = Route.useSearch();
    const navigate = useNavigate({ from: '/trends' });
    const view = useMemo(() => trendsView(search), [search]);
    const { packages, metric, range, group } = view;
    const colors = useSeriesColors(packages);

    const change = (next: TrendsSearch) => {
        void navigate({ search: (current) => validateTrendsSearch({ ...current, ...next }), resetScroll: false, replace: true });
    };
    const setPackages = useCallback(
        (names: readonly string[]) => {
            void navigate({ search: (current) => validateTrendsSearch({ ...current, packages: names.join(',') }), resetScroll: false });
        },
        [navigate],
    );
    const remove = useCallback((name: string) => setPackages(packages.filter((candidate) => candidate !== name)), [packages, setPackages]);

    const analyses = useQueries({ queries: packages.map((name) => analysisQuery(name)) });
    const recentDownloads = useQueries({ queries: packages.map((name) => downloadsQuery(name, '2m')) });
    const stars = useQueries({
        queries: packages.map((_, index) => {
            const data = analyses[index]?.data;
            return starsQuery(repositoryOf(data?.status === 'done' ? data.result.repositoryUrl : undefined));
        }),
    });
    const histories = useQueries({
        queries: packages.map((name) => ({ ...historyQuery(name), enabled: metric === 'size' })),
        combine: (results) => ({ data: results.map((result) => result.data), pending: results.some((result) => result.isLoading) }),
    });
    const rangeDownloads = useQueries({
        queries: packages.map((name) => ({ ...downloadsQuery(name, range), enabled: metric === 'downloads', placeholderData: keepPreviousData })),
        combine: (results) => ({ data: results.map((result) => result.data), pending: results.some((result) => result.isLoading || result.isPlaceholderData) }),
    });

    useMeasureOnce(histories.data, metric === 'size');

    const now = today();

    const rows = useMemo<TrendRow[]>(() => {
        if (metric === 'size') return sizeRows(histories.data);
        return rangeDownloads.data.flatMap((data) => (data === undefined ? [] : groupDownloads(data.days, group, now).map((point) => ({ name: data.name, ...point }))));
    }, [metric, group, now, histories.data, rangeDownloads.data]);

    const series = useMemo(() => packages.map((name) => ({ name, color: colors.get(name) ?? SERIES_COLORS[0] })), [packages, colors]);
    const measuring =
        metric === 'size' ? histories.data.reduce((sum, history) => sum + (history?.versions.filter((entry) => entry.status === 'queued' || entry.status === 'running').length ?? 0), 0) : 0;
    const metricWord = metric === 'size' ? 'Minified + gzip size of recent versions, by release date' : `Downloads per ${group}`;

    // Drawing thousands of points takes a moment too. It waits behind this render, so the mask shows first, and it is
    // only done again when what it draws has changed.
    const chart = useMemo(
        () => ({
            rows,
            series,
            releases: metric === 'size',
            until: Date.parse(now),
            formatValue: metric === 'size' ? formatSizeText : formatCount,
            ariaLabel: `${metricWord}: ${packages.join(', ')}`,
        }),
        [rows, series, metric, now, metricWord, packages],
    );
    const drawn = useDeferredValue(chart);
    const fetching = metric === 'size' ? histories.pending : rangeDownloads.pending;
    const loading = fetching || drawn !== chart;

    const tableRows: TrendsTableRow[] = packages.map((name, index) => {
        const analysis = analyses[index];
        const data = analysis?.data;
        const result = data?.status === 'done' ? data.result : undefined;
        const days = recentDownloads[index]?.data?.days;
        return {
            name,
            version: data?.package.version,
            color: colors.get(name) ?? SERIES_COLORS[0],
            state: stateOf(data, analysis?.error),
            gzip: result?.sizes?.gzip,
            minified: result?.sizes?.minified,
            install: result?.install.bytes,
            weekly: days === undefined ? undefined : weeklyDownloads(days, now),
            stars: stars[index]?.data?.stars ?? undefined,
            repositoryUrl: result?.repositoryUrl ?? undefined,
        };
    });

    return (
        <main
            id={'main'}
            tabIndex={-1}
            className={'mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:py-14'}
        >
            <div className={'flex flex-col gap-2'}>
                <h1 className={'text-title-1'}>Package trends</h1>
                <p className={'max-w-2xl text-callout text-muted-foreground'}>Compare size and downloads across up to {MAX_TREND_PACKAGES} packages.</p>
            </div>

            <div className={'flex flex-wrap items-center gap-2'}>
                {packages.map((name) => (
                    <span
                        key={name}
                        className={'inline-flex min-h-10 items-center gap-2 rounded-4xl bg-muted pr-1.5 pl-3.5 font-mono text-code'}
                    >
                        <span
                            aria-hidden={'true'}
                            className={'size-2.5 rounded-xs'}
                            style={{ background: colors.get(name) }}
                        />
                        {name}
                        <button
                            type={'button'}
                            aria-label={`Remove ${name}`}
                            onClick={() => remove(name)}
                            className={
                                'inline-flex size-7 items-center justify-center rounded-4xl text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
                            }
                        >
                            <X
                                aria-hidden={'true'}
                                className={'size-3.5'}
                            />
                        </button>
                    </span>
                ))}
                {packages.length < MAX_TREND_PACKAGES && (
                    <div className={'w-full max-w-xs'}>
                        <PackageSearch
                            compact
                            secondary
                            onPick={(spec) => {
                                const name = parseSpec(spec)?.name;
                                if (name !== undefined && !packages.includes(name)) setPackages([...packages, name]);
                            }}
                        />
                    </div>
                )}
            </div>

            {packages.length === 0 ? (
                <div className={'flex flex-col items-center gap-4 py-10 text-center'}>
                    <IsoPackage className={'h-auto w-full max-w-sm'} />
                    <p className={'text-callout text-muted-foreground'}>Add a package above to start comparing.</p>
                </div>
            ) : (
                <div
                    aria-busy={loading}
                    className={'relative flex flex-col gap-8'}
                >
                    <div
                        inert={loading}
                        className={'flex flex-col gap-8'}
                    >
                        <div className={'flex flex-wrap items-center justify-between gap-3'}>
                            <div className={'flex flex-wrap items-center gap-3'}>
                                <SegmentedControl
                                    label={'Metric'}
                                    value={metric}
                                    options={METRICS}
                                    onChange={(next) => change({ metric: next })}
                                />
                                {metric === 'downloads' && (
                                    <>
                                        <SegmentedControl
                                            label={'Range'}
                                            value={range}
                                            options={RANGES}
                                            onChange={(next) => change({ range: next })}
                                        />
                                        <SegmentedControl
                                            label={'Group by'}
                                            value={group}
                                            options={GROUPS}
                                            onChange={(next) => change({ group: next })}
                                        />
                                    </>
                                )}
                            </div>
                            <CopyLink />
                        </div>

                        <section
                            aria-labelledby={'trend-title'}
                            className={'flex flex-col gap-3'}
                        >
                            <div className={'flex flex-wrap items-baseline justify-between gap-x-4'}>
                                <h2
                                    id={'trend-title'}
                                    className={'text-headline'}
                                >
                                    {metricWord}
                                </h2>
                                <p
                                    role={'status'}
                                    className={'text-caption text-muted-foreground'}
                                >
                                    {measuring > 0 ? `Measuring ${measuring} more ${measuring === 1 ? 'version' : 'versions'}…` : ''}
                                </p>
                            </div>
                            {drawn.rows.length === 0 ? (
                                <div className={'flex h-105 items-center justify-center border-y text-callout text-muted-foreground'}>
                                    {loading || measuring > 0 ? '' : 'Nothing to show for these packages.'}
                                </div>
                            ) : (
                                <TrendsChart
                                    rows={drawn.rows}
                                    series={drawn.series}
                                    releases={drawn.releases}
                                    until={drawn.until}
                                    formatValue={drawn.formatValue}
                                    ariaLabel={drawn.ariaLabel}
                                />
                            )}
                        </section>

                        <section
                            aria-labelledby={'snapshot-title'}
                            className={'flex flex-col gap-2'}
                        >
                            <h2
                                id={'snapshot-title'}
                                className={'text-overline text-muted-foreground uppercase'}
                            >
                                Snapshot
                            </h2>
                            <TrendsTable
                                rows={tableRows}
                                onRemove={remove}
                            />
                        </section>
                    </div>
                    {loading && (
                        <div
                            role={'status'}
                            className={'trends-mask absolute inset-0 z-20 flex items-start justify-center rounded-lg pt-56'}
                        >
                            <span className={'flex items-center gap-2.5 rounded-4xl border bg-popover px-5 py-2.5 text-callout text-popover-foreground shadow-lg'}>
                                <LoaderCircle
                                    aria-hidden={'true'}
                                    className={'size-4 animate-spin text-link'}
                                />
                                Loading…
                            </span>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
};

export const Route = createFileRoute('/trends')({
    validateSearch: validateTrendsSearch,
    head: ({ match }) => {
        const named = match.search.packages;
        const names = named === undefined ? [] : parsePackages(named);
        return pageHead({
            title: names.length > 0 ? `${names.join(' vs ')}: size and downloads` : 'npm package trends: compare size and downloads',
            description:
                names.length > 0
                    ? `Compare ${names.join(', ')}: minified and gzip size across releases, weekly downloads and GitHub stars, side by side.`
                    : 'Compare npm packages side by side: minified and gzip size across releases, downloads over time, install size and GitHub stars.',
            path: '/trends',
            // A comparison of any packages is a view of this one page: only the page itself is listed.
            noindex: names.length > 0,
            breadcrumbs: [
                { name: siteConfig.title, path: '/' },
                { name: 'Trends', path: '/trends' },
            ],
        });
    },
    component: TrendsPage,
});
