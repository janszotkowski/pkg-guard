import { Suspense, lazy } from 'react';
import { DEFAULT_HEIGHT, type TrendsChartProps } from '@components/TrendsChartRenderer';

export type { TrendSeries, TrendsChartProps } from '@components/TrendsChartRenderer';

/** The chart and the charting library behind it, in a chunk of their own: the page's controls and table come first. */
const Renderer = lazy(async () => ({ default: (await import('@components/TrendsChartRenderer')).TrendsChartRenderer }));

/** The packages over time. Until the chart's code has arrived, a block of its height holds its place, so nothing under it moves. */
export const TrendsChart = (props: TrendsChartProps) => (
    <Suspense
        fallback={
            <div
                aria-hidden={'true'}
                className={'skeleton w-full'}
                style={{ height: props.height ?? DEFAULT_HEIGHT }}
            />
        }
    >
        <Renderer {...props} />
    </Suspense>
);
