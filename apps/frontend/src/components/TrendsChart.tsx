import { areaY, d3Curve, defineChart, dot, lineY, text, type ChartPoint } from '@tanstack/charts';
import { crosshair } from '@tanstack/charts/crosshair';
import { motion } from '@tanstack/charts/motion';
import { stagger } from '@tanstack/charts/motion/definition';
import { RendererChart, type ChartTooltipBodyRenderContext } from '@tanstack/charts/react/tooltip';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { curveMonotoneX } from 'd3-shape';
import { memo, useCallback, useMemo } from 'react';
import { dayLabel, monthLabel, monthTicks } from '@lib/trends';

export type TrendRow = {
    name: string;
    time: number;
    value: number;
    /** What the tooltip adds to the name, such as the version released on this date. */
    detail?: string;
};

export type TrendSeries = { name: string; color: string };

type TrendsChartProps = {
    rows: readonly TrendRow[];
    /** Every package on the page, with its color: one that has no rows yet keeps its place. */
    series: readonly TrendSeries[];
    /**
     * The values are releases: a package keeps a size until its next release, so the line runs in steps up to `until`, and
     * only the releases carry a dot. Otherwise every row is a measurement of its own period, on dates all packages share.
     */
    releases: boolean;
    until: number;
    formatValue: (value: number) => string;
    ariaLabel: string;
    height?: number;
};

/** A point drawn to keep the shape of the line. It is no measurement, so it has no dot and says nothing in the tooltip when a real one is there. */
type PlotRow = TrendRow & { key: string; drawn: boolean };

/** A label needs this share of the chart's height between it and the next, or the line goes without: the colors and the table still name it. */
const LABEL_GAP = 0.07;

/** One spring for every chart, so a change of data moves from where the marks are. `motion()` respects reduced motion by itself. */
const renderer = motion({ transition: { type: 'spring', stiffness: 170, damping: 24, mass: 1 } });

const plotRows = (rows: readonly TrendRow[], releases: boolean, until: number): PlotRow[] => {
    const real = (row: TrendRow): PlotRow => ({ ...row, key: `${row.time}`, drawn: false });
    if (!releases) return rows.map(real);
    const plotted: PlotRow[] = [];
    rows.forEach((row, index) => {
        const previous = rows[index - 1];
        if (previous !== undefined) plotted.push({ ...previous, time: row.time, key: `${row.time}:before`, drawn: true });
        plotted.push(real(row));
    });
    const last = rows.at(-1);
    if (last !== undefined && last.time < until) plotted.push({ ...last, time: until, key: 'until', drawn: true });
    return plotted;
};

const fillId = (index: number): string => `trend-fill-${index}`;
const lineId = (index: number): string => `trend-line-${index}`;

/** Periods flow into each other, so they get a smooth line that never overshoots a real value. Sizes change at releases and keep their steps. */
const smooth = d3Curve(curveMonotoneX);

/**
 * What every package stood at on a date, largest first: the row of that date, or its last release before it. A package
 * that did not exist yet has no row. The rows of each package come in order of time.
 */
const rowsAt = (rows: readonly TrendRow[], time: number): TrendRow[] => {
    const latest = new Map<string, TrendRow>();
    for (const row of rows) if (row.time <= time) latest.set(row.name, row);
    return [...latest.values()].sort((a, b) => b.value - a.value);
};

const trendDefinition = (props: TrendsChartProps) => {
    const groups = props.series.map((entry, index) => ({
        ...entry,
        index,
        rows: plotRows(
            props.rows.filter((row) => row.name === entry.name),
            props.releases,
            props.until,
        ),
    }));
    const plotted = groups.flatMap((group) => group.rows);
    const times = plotted.map((row) => row.time);
    const from = Math.min(...times);
    const to = Math.max(...times);
    const largest = Math.max(...plotted.map((row) => row.value), 1);

    const labels: (PlotRow & { label: string })[] = [];
    const ends = groups.flatMap((group) => {
        const last = group.rows.at(-1);
        return last === undefined ? [] : [{ ...last, drawn: true, label: props.series.length === 1 ? props.formatValue(last.value) : `${group.name} ${props.formatValue(last.value)}` }];
    });
    for (const end of ends.sort((one, other) => other.value - one.value)) {
        if (labels.every((label) => (label.value - end.value) / largest >= LABEL_GAP)) labels.push(end);
    }

    return defineChart({
        chart: ({ width }) => ({
            motion: { path: 'morph', ...stagger({ each: 90, roles: 'line', by: 'series' }) },
            margin: { right: 16 + Math.max(0, ...labels.map((label) => label.label.length * 7)) },
            marks: [
                ...groups.map((group) =>
                    areaY(group.rows, {
                        id: `area-${group.index}`,
                        x: 'time',
                        y1: 0,
                        y2: 'value',
                        key: 'key',
                        color: 'name',
                        fill: `url(#${fillId(group.index)})`,
                        fillOpacity: 1,
                        ...(props.releases ? {} : { curve: smooth }),
                    }),
                ),
                ...groups.map((group) =>
                    lineY(group.rows, {
                        id: `line-${group.index}`,
                        x: 'time',
                        y: 'value',
                        key: 'key',
                        color: 'name',
                        stroke: `url(#${lineId(group.index)})`,
                        strokeWidth: 2.25,
                        ...(props.releases ? {} : { curve: smooth }),
                    }),
                ),
                ...(props.releases
                    ? groups.map((group) =>
                          dot(
                              group.rows.filter((row) => !row.drawn),
                              { id: `dot-${group.index}`, x: 'time', y: 'value', key: 'key', color: 'name', r: 3.5 },
                          ),
                      )
                    : []),
                text(labels, { id: 'labels', x: 'time', y: 'value', text: 'label', key: 'name', dx: 8, anchor: 'start', fill: 'currentColor', fontSize: 12 }),
                // A thin line marks the date, and the card stands beside it.
                crosshair({ x: { stroke: 'var(--muted-foreground)', strokeOpacity: 0.5, strokeWidth: 1 }, y: false }),
            ],
            scales: {
                x: {
                    scale: scaleLinear,
                    axis: {
                        line: false,
                        ticks: {
                            // A label right at the start would run into the labels of the other axis.
                            values: monthTicks(from, to, width - 140).filter((tick) => tick - from > (to - from) * 0.04),
                            format: (value: number) => monthLabel(value),
                            size: 0,
                        },
                    },
                },
                y: {
                    scale: scaleLinear,
                    nice: true,
                    grid: { stroke: 'var(--border)' },
                    axis: { line: false, ticks: { size: 0, format: (value: number) => props.formatValue(value) } },
                },
            },
            color: { domain: props.series.map((entry) => entry.name), range: props.series.map((entry) => entry.color) },
            gradients: groups.flatMap((group) => [
                {
                    id: fillId(group.index),
                    x1: 0,
                    y1: 0,
                    x2: 0,
                    y2: 1,
                    stops: [
                        // How strong the top of the fade is depends on the page behind it: see `--trend-fill` in the stylesheet.
                        { offset: 0, color: `color-mix(in oklch, ${group.color} var(--trend-fill), transparent)`, opacity: 1 },
                        { offset: 1, color: group.color, opacity: 0 },
                    ],
                },
                {
                    id: lineId(group.index),
                    x1: 0,
                    y1: 0,
                    x2: 1,
                    y2: 0,
                    stops: [
                        { offset: 0, color: `color-mix(in oklch, ${group.color}, white 45%)`, opacity: 1 },
                        { offset: 1, color: group.color, opacity: 1 },
                    ],
                },
            ]),
        }),
        focus: props.releases ? ('nearest-x' as const) : ('group-x' as const),
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
            use: tooltip,
            // It would otherwise inherit the chart's spring, and glide over from wherever it last was: it shows where it belongs, at once.
            motion: false,
            // Beside the date at the top of the plot, so it moves only along the time axis, whichever line the pointer is near.
            // It goes to the left only where there is no room on the right.
            anchor: { x: 'value', y: 'plot-top' },
            placement: ['right', 'left'],
            offset: 14,
            content: (focused: readonly ChartPoint<PlotRow>[]) => {
                const first = focused[0]?.datum;
                return {
                    title: first === undefined ? '' : dayLabel(first.time),
                    rows: (first === undefined ? [] : rowsAt(props.rows, first.time)).map((row) => ({
                        label: row.detail === undefined ? row.name : `${row.name} ${row.detail}`,
                        value: props.formatValue(row.value),
                        color: props.series.find((entry) => entry.name === row.name)?.color ?? 'currentColor',
                    })),
                };
            },
        },
    });
};

type FocusCardProps = {
    context: ChartTooltipBodyRenderContext<PlotRow>;
    rows: readonly TrendRow[];
    series: readonly TrendSeries[];
    formatValue: (value: number) => string;
};

/** The focused date and where every package stood on it: the value first, then whose it is, each beside its own color. */
const FocusCard = (props: FocusCardProps) => {
    const time = props.context.points[0]?.datum.time;
    if (time === undefined) return null;
    return (
        <div className={'trend-focus-card flex w-max max-w-72 min-w-44 flex-col gap-2 px-3.5 py-3'}>
            <p className={'text-caption text-muted-foreground'}>{dayLabel(time)}</p>
            <ul className={'flex flex-col gap-1.5'}>
                {rowsAt(props.rows, time).map((row) => (
                    <li
                        key={row.name}
                        className={'flex items-baseline justify-between gap-6'}
                    >
                        <span className={'flex min-w-0 items-baseline gap-2 text-caption font-normal text-muted-foreground'}>
                            <span
                                aria-hidden={'true'}
                                className={'h-0.5 w-3 shrink-0 translate-y-[-0.2em] rounded-full'}
                                style={{ background: props.series.find((entry) => entry.name === row.name)?.color }}
                            />
                            <span className={'truncate'}>{row.name}</span>
                            {row.detail !== undefined && <span className={'shrink-0 font-mono text-subtle-foreground'}>{row.detail}</span>}
                        </span>
                        <span className={'text-callout font-semibold text-foreground tabular-nums'}>{props.formatValue(row.value)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

/**
 * The packages over time, drawn with TanStack Charts. The same packages and their current numbers are in the table under
 * it. Memoized: drawing is the slow part, and it should only happen when what it draws changes.
 */
export const TrendsChart = memo((props: TrendsChartProps) => {
    const definition = useMemo(() => trendDefinition(props), [props]);
    const { rows, series, formatValue } = props;
    const renderBody = useCallback(
        (context: ChartTooltipBodyRenderContext<PlotRow>) => (
            <FocusCard
                context={context}
                rows={rows}
                series={series}
                formatValue={formatValue}
            />
        ),
        [rows, series, formatValue],
    );
    return (
        <div className={'trend-chart'}>
            <RendererChart
                definition={definition}
                renderer={renderer}
                renderTooltipBody={renderBody}
                ariaLabel={props.ariaLabel}
                ariaDescription={'The current numbers of every package are in the table under the chart.'}
                height={props.height ?? 420}
                initialWidth={1100}
            />
        </div>
    );
});
