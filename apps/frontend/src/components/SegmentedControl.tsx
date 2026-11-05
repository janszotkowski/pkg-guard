import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@lib/utils';

type Option<Value extends string> = { value: Value; label: string; count?: number };

type SegmentedControlProps<Value extends string> = {
    label: string;
    value: Value;
    options: readonly Option<Value>[];
    onChange: (value: Value) => void;
    className?: string;
};

/** Which option a key moves to, by the ARIA radio group pattern; undefined for any other key. */
export const segmentStep = (key: string, index: number, count: number): number | undefined => {
    switch (key) {
        case 'ArrowRight':
        case 'ArrowDown':
            return (index + 1) % count;
        case 'ArrowLeft':
        case 'ArrowUp':
            return (index - 1 + count) % count;
        case 'Home':
            return 0;
        case 'End':
            return count - 1;
        default:
            return undefined;
    }
};

/**
 * One choice out of a few, as a row of pills: a radio group to assistive technology, and to the keyboard too. The
 * group is one stop of the Tab key (the chosen option); the arrow keys, Home and End move the choice, which applies at once.
 * Each option is a 44 px touch target and may carry a count.
 */
export const SegmentedControl = <Value extends string>(props: SegmentedControlProps<Value>) => {
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const selected = Math.max(
        0,
        props.options.findIndex((option) => option.value === props.value),
    );

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const next = segmentStep(event.key, selected, props.options.length);
        const option = next === undefined ? undefined : props.options[next];
        if (next === undefined || option === undefined) return;
        event.preventDefault();
        props.onChange(option.value);
        buttons.current[next]?.focus();
    };

    return (
        <div
            role={'radiogroup'}
            aria-label={props.label}
            className={cn('inline-flex rounded-4xl bg-muted p-1', props.className)}
        >
            {props.options.map((option, index) => {
                const checked = index === selected;
                return (
                    <button
                        key={option.value}
                        ref={(element) => {
                            buttons.current[index] = element;
                        }}
                        type={'button'}
                        role={'radio'}
                        aria-checked={checked}
                        tabIndex={checked ? 0 : -1}
                        onClick={() => props.onChange(option.value)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            'inline-flex min-h-11 items-center gap-1.5 rounded-4xl px-4 text-caption whitespace-nowrap transition-colors duration-100',
                            checked
                                ? 'bg-card text-foreground shadow-sm forced-colors:outline-2 forced-colors:outline-offset-[-2px] forced-colors:outline-[Highlight] dark:bg-secondary dark:ring-1 dark:ring-border'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {option.label}
                        {option.count !== undefined && <span className={cn('tabular-nums', checked ? 'opacity-70' : 'text-subtle-foreground')}>{option.count}</span>}
                    </button>
                );
            })}
        </div>
    );
};
