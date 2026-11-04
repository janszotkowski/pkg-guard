type FigureBandProps = {
    items: readonly { label: string; value: string; hint: string }[];
};

/** Numbers in one ruled band: each a number, its name and a line of context; two by two on a phone, in a row from a tablet up. */
export const FigureBand = (props: FigureBandProps) => (
    <ul className={'grid grid-cols-2 divide-x divide-y border-y md:grid-cols-4 md:divide-y-0'}>
        {props.items.map((figure) => (
            <li
                key={figure.label}
                className={'flex min-w-0 flex-col gap-1 px-4 py-6 first:pl-0 sm:px-6 sm:first:pl-0'}
            >
                <span className={'text-score text-[clamp(1.75rem,4vw,2.5rem)] tabular-nums'}>{figure.value}</span>
                <span className={'text-callout font-semibold'}>{figure.label}</span>
                <span className={'text-caption text-subtle-foreground'}>{figure.hint}</span>
            </li>
        ))}
    </ul>
);
