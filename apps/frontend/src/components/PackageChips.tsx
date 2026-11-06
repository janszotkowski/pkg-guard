import { parseSpec } from '@weighme/core';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { PackageSearch } from '@components/PackageSearch';
import { Button } from '@components/ui/button';
import { MAX_TREND_PACKAGES } from '@lib/trends';

/** Where the keyboard goes once the list has changed, since what it was on may have gone with the change. */
export type ChipFocus = { kind: 'chip'; name: string } | { kind: 'search' };

type PackageChipsProps = {
    packages: readonly string[];
    colors: ReadonlyMap<string, string>;
    onRemove: (name: string) => void;
    onAdd: (name: string) => void;
    focus: ChipFocus | undefined;
    /** Called once `focus` has been honoured, so that it is not honoured again on a later change of the list. */
    onFocused: () => void;
};

/** The packages on the page, each with its color and a way out, and a field to add one while there is room. */
export const PackageChips = (props: PackageChipsProps) => {
    const buttons = useRef(new Map<string, HTMLButtonElement>());
    const field = useRef<HTMLInputElement | null>(null);
    const { focus, onFocused } = props;

    // A chip that is still to come is not there on the first pass; the list changing runs this again.
    useEffect(() => {
        if (focus === undefined) return;
        const element = focus.kind === 'search' ? field.current : buttons.current.get(focus.name);
        if (element === null || element === undefined) return;
        element.focus();
        onFocused();
    }, [focus, onFocused, props.packages]);

    return (
        <div className={'flex flex-wrap items-center gap-2'}>
            {props.packages.map((name) => (
                <span
                    key={name}
                    className={'inline-flex min-h-10 items-center gap-2 rounded-4xl bg-muted pr-1.5 pl-3.5 font-mono text-code'}
                >
                    <span
                        aria-hidden={'true'}
                        className={'size-2.5 rounded-xs'}
                        style={{ background: props.colors.get(name) }}
                    />
                    {name}
                    <Button
                        ref={(element) => {
                            if (element === null) buttons.current.delete(name);
                            else buttons.current.set(name, element);
                        }}
                        variant={'ghost'}
                        size={'icon-sm'}
                        aria-label={`Remove ${name}`}
                        onClick={() => props.onRemove(name)}
                        className={'rounded-4xl text-muted-foreground hover:text-foreground'}
                    >
                        <X
                            aria-hidden={'true'}
                            className={'size-3.5'}
                        />
                    </Button>
                </span>
            ))}
            {props.packages.length < MAX_TREND_PACKAGES && (
                <div className={'w-full max-w-xs'}>
                    <PackageSearch
                        compact
                        secondary
                        fieldRef={field}
                        onPick={(spec) => {
                            const name = parseSpec(spec)?.name;
                            if (name !== undefined) props.onAdd(name);
                        }}
                    />
                </div>
            )}
        </div>
    );
};
