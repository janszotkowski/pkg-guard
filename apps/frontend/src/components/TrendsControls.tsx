import type { TrendRange } from '@pkg-guard/core';
import { CopyButton } from '@components/CopyButton';
import { SegmentedControl } from '@components/SegmentedControl';
import type { TrendGroup, TrendMetric, TrendsSearch } from '@lib/trends';

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

type TrendsControlsProps = {
    metric: TrendMetric;
    range: TrendRange;
    group: TrendGroup;
    /** Puts the choice in the address, where everything the page shows lives. */
    onChange: (next: TrendsSearch) => void;
};

/** What the chart shows and over what span, with a way to carry the view away. The range and the grouping only mean something for downloads. */
export const TrendsControls = (props: TrendsControlsProps) => (
    <div className={'flex flex-wrap items-center justify-between gap-3'}>
        <div className={'flex flex-wrap items-center gap-3'}>
            <SegmentedControl
                label={'Metric'}
                value={props.metric}
                options={METRICS}
                onChange={(next) => props.onChange({ metric: next })}
            />
            {props.metric === 'downloads' && (
                <>
                    <SegmentedControl
                        label={'Range'}
                        value={props.range}
                        options={RANGES}
                        onChange={(next) => props.onChange({ range: next })}
                    />
                    <SegmentedControl
                        label={'Group by'}
                        value={props.group}
                        options={GROUPS}
                        onChange={(next) => props.onChange({ group: next })}
                    />
                </>
            )}
        </div>
        <CopyButton
            label={'Copy link'}
            variant={'secondary'}
            getText={() => location.href}
        />
    </div>
);
