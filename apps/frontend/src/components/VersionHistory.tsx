import type { VersionEntry } from '@pkg-guard/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { TrendsChart, type TrendRow } from '@components/TrendsChart';
import { historyQuery } from '@lib/api';
import { formatSizeText } from '@lib/format';
import { dayLabel } from '@lib/trends';
import { useMeasureOnce } from '@lib/useMeasureOnce';

const STATUS_TEXT: Record<Exclude<VersionEntry['status'], 'done'>, string> = {
    unmeasured: 'Waiting…',
    queued: 'Waiting…',
    running: 'Measuring…',
    failed: 'Could not be measured',
};

const HEADER_CELL = 'px-3 py-2 text-caption font-medium text-muted-foreground first:pl-0 last:pr-0';
const NUMBER_CELL = 'px-3 py-2.5 text-right tabular-nums whitespace-nowrap last:pr-0';

/** How much a version moved from the measured one before it. */
const changeText = (gzip: number | null, previous: number | undefined): string => {
    if (gzip === null || previous === undefined) return '—';
    const delta = gzip - previous;
    if (delta === 0) return 'No change';
    return `${delta > 0 ? '+' : '−'}${formatSizeText(Math.abs(delta))}`;
};

const today = (): number => Date.parse(new Date().toISOString().slice(0, 10));

type VersionHistoryProps = { name: string; version: string };

/** How the package's size moved across its releases: a chart for the shape, and a table for the numbers. */
export const VersionHistory = (props: VersionHistoryProps) => {
    const { name } = props;
    const { data, isError } = useQuery(historyQuery(name));
    const histories = useMemo(() => [data], [data]);
    useMeasureOnce(histories, true);

    const versions = data?.versions;
    const rows = useMemo<TrendRow[]>(
        () =>
            (versions ?? [])
                .flatMap((entry): TrendRow[] => (entry.gzip === null || entry.publishedAt === null ? [] : [{ name, time: Date.parse(entry.publishedAt), value: entry.gzip, detail: entry.version }]))
                .sort((a, b) => a.time - b.time),
        [versions, name],
    );
    const series = useMemo(() => [{ name, color: 'var(--series-1)' }], [name]);

    if (isError) return <p className={'text-callout text-muted-foreground'}>The versions could not be loaded. Try again in a moment.</p>;
    if (versions === undefined) return <div className={'skeleton h-80 w-full'} />;
    if (versions.length === 0) return <p className={'text-callout text-muted-foreground'}>This package has no stable releases to compare.</p>;

    const waiting = versions.filter((entry) => entry.status === 'unmeasured' || entry.status === 'queued' || entry.status === 'running').length;

    return (
        <div className={'flex flex-col gap-6'}>
            <div className={'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'}>
                <p className={'text-callout text-muted-foreground'}>Minified + gzip size of recent releases. A package keeps its size until its next release.</p>
                <p
                    role={'status'}
                    className={'text-caption text-muted-foreground'}
                >
                    {waiting > 0 ? `Measuring ${waiting} more ${waiting === 1 ? 'version' : 'versions'}…` : ''}
                </p>
            </div>
            {rows.length >= 2 && (
                <TrendsChart
                    rows={rows}
                    series={series}
                    releases
                    until={today()}
                    formatValue={formatSizeText}
                    ariaLabel={`Minified and gzipped size of ${name} over its releases`}
                    height={320}
                />
            )}
            <div className={'overflow-x-auto'}>
                <table className={'w-full text-left text-callout'}>
                    <caption className={'sr-only'}>Size of each recent version, newest first</caption>
                    <thead>
                        <tr className={'border-b'}>
                            <th
                                scope={'col'}
                                className={HEADER_CELL}
                            >
                                Version
                            </th>
                            <th
                                scope={'col'}
                                className={`${HEADER_CELL} hidden sm:table-cell`}
                            >
                                Released
                            </th>
                            <th
                                scope={'col'}
                                className={`${HEADER_CELL} text-right`}
                            >
                                Gzip
                            </th>
                            <th
                                scope={'col'}
                                className={`${HEADER_CELL} hidden text-right sm:table-cell`}
                            >
                                Minified
                            </th>
                            <th
                                scope={'col'}
                                className={`${HEADER_CELL} text-right`}
                            >
                                Change
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {versions.map((entry, index) => {
                            const previous = versions.slice(index + 1).find((older) => older.gzip !== null)?.gzip ?? undefined;
                            const current = entry.version === props.version;
                            return (
                                <tr
                                    key={entry.version}
                                    className={'border-b last:border-0'}
                                >
                                    <td className={'py-2.5 pr-3'}>
                                        {current ? (
                                            <span className={'font-mono text-code font-semibold'}>{entry.version}</span>
                                        ) : (
                                            <Link
                                                to={'/package/$'}
                                                params={{ _splat: `${name}@${entry.version}` }}
                                                className={'font-mono text-code text-link underline-offset-2 hover:underline'}
                                            >
                                                {entry.version}
                                            </Link>
                                        )}
                                    </td>
                                    <td className={'hidden px-3 py-2.5 whitespace-nowrap text-muted-foreground sm:table-cell'}>
                                        {entry.publishedAt === null ? '—' : dayLabel(Date.parse(entry.publishedAt))}
                                    </td>
                                    <td className={`${NUMBER_CELL} font-semibold`}>
                                        {entry.status === 'done' ? (
                                            entry.gzip === null ? (
                                                '—'
                                            ) : (
                                                formatSizeText(entry.gzip)
                                            )
                                        ) : (
                                            <span className={'text-caption font-normal text-muted-foreground'}>{STATUS_TEXT[entry.status]}</span>
                                        )}
                                    </td>
                                    <td className={`${NUMBER_CELL} hidden text-muted-foreground sm:table-cell`}>{entry.minified === null ? '—' : formatSizeText(entry.minified)}</td>
                                    <td className={`${NUMBER_CELL} text-muted-foreground`}>{changeText(entry.gzip, previous)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
