import type { VersionEntry } from '@pkg-guard/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { TrendsChart } from '@components/TrendsChart';
import { historyQuery } from '@lib/api';
import { formatSizeText } from '@lib/format';
import { HEADER_CELL, NUMBER_CELL, TEXT_CELL } from '@lib/tableClasses';
import { dayLabel, measuringText, todayIso, versionRows } from '@lib/trends';
import { useMeasureOnce } from '@lib/useMeasureOnce';

const STATUS_TEXT: Record<Exclude<VersionEntry['status'], 'done'>, string> = {
    unmeasured: 'Waiting…',
    queued: 'Waiting…',
    running: 'Measuring…',
    failed: 'Could not be measured',
};

/** How much a version moved from the measured one before it. */
const changeText = (gzip: number | null, previous: number | undefined): string => {
    if (gzip === null || previous === undefined) return '—';
    const delta = gzip - previous;
    if (delta === 0) return 'No change';
    return `${delta > 0 ? '+' : '−'}${formatSizeText(Math.abs(delta))}`;
};

/** For each version, the gzip size of the nearest older one that has been measured. The versions come newest first, so one pass from the end finds them all. */
const previousGzips = (versions: readonly VersionEntry[]): (number | undefined)[] => {
    const previous: (number | undefined)[] = [];
    let last: number | undefined;
    for (let index = versions.length - 1; index >= 0; index--) {
        previous[index] = last;
        const gzip = versions[index]?.gzip;
        if (gzip !== null && gzip !== undefined) last = gzip;
    }
    return previous;
};

type VersionHistoryProps = { name: string; version: string };

/** How the package's size moved across its releases: a chart for the shape, and a table for the numbers. */
export const VersionHistory = (props: VersionHistoryProps) => {
    const { name } = props;
    const { data, isError } = useQuery(historyQuery(name));
    const histories = useMemo(() => [data], [data]);
    useMeasureOnce(histories, true);
    // Read once, so that the server and the browser do not disagree within one pass.
    const [today] = useState(todayIso);

    const versions = data?.versions;
    const rows = useMemo(() => versionRows(name, versions ?? []), [versions, name]);
    const series = useMemo(() => [{ name, color: 'var(--series-1)' }], [name]);

    if (isError) return <p className={'text-callout text-muted-foreground'}>The versions could not be loaded. Try again in a moment.</p>;
    if (versions === undefined) return <div className={'skeleton h-80 w-full'} />;
    if (versions.length === 0) return <p className={'text-callout text-muted-foreground'}>This package has no stable releases to compare.</p>;

    const waiting = versions.filter((entry) => entry.status === 'unmeasured' || entry.status === 'queued' || entry.status === 'running').length;
    const previous = previousGzips(versions);

    return (
        <div className={'flex flex-col gap-6'}>
            <div className={'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'}>
                <p className={'text-callout text-muted-foreground'}>Minified + gzip size of recent releases. A package keeps its size until its next release.</p>
                <p
                    role={'status'}
                    className={'text-caption text-muted-foreground'}
                >
                    {measuringText(waiting)}
                </p>
            </div>
            {rows.length >= 2 && (
                <TrendsChart
                    rows={rows}
                    series={series}
                    releases
                    until={Date.parse(today)}
                    formatValue={formatSizeText}
                    ariaLabel={`Minified and gzipped size of ${name} over its releases`}
                    height={320}
                />
            )}
            {/* A named region the keyboard can reach: on a narrow screen the table scrolls sideways, and the arrow keys scroll it. */}
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div
                role={'region'}
                aria-label={'Versions'}
                tabIndex={0}
                className={'overflow-x-auto'}
            >
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
                            const current = entry.version === props.version;
                            return (
                                <tr
                                    key={entry.version}
                                    className={'border-b last:border-0'}
                                >
                                    <td className={TEXT_CELL}>
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
                                    <td className={`${TEXT_CELL} hidden whitespace-nowrap text-muted-foreground sm:table-cell`}>
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
                                    <td className={`${NUMBER_CELL} text-muted-foreground`}>{changeText(entry.gzip, previous[index])}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
