import type { ExportDetails, ExportsState } from '@pkg-guard/core';
import { useMemo, useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { formatSizeText } from '@lib/format';

/** How many exports are listed before the visitor asks for the rest. */
const COLLAPSED = 20;

type PartRowProps = { name: string; minified: number; gzip: number };

const PartRow = (props: PartRowProps) => (
    <li className={'flex items-baseline justify-between gap-4 py-2.5'}>
        <span className={'min-w-0 font-mono text-code break-all'}>{props.name}</span>
        <span className={'flex shrink-0 items-baseline gap-4 tabular-nums'}>
            <span className={'text-callout font-semibold'}>{formatSizeText(props.gzip)}</span>
            <span className={'hidden w-20 text-right text-caption text-subtle-foreground sm:inline'}>{formatSizeText(props.minified)}</span>
        </span>
    </li>
);

type PartHeadingProps = { title: string; note: string };

const PartHeading = (props: PartHeadingProps) => (
    <h3 className={'flex flex-wrap items-baseline justify-between gap-x-4 border-b pb-2 text-headline'}>
        <span>{props.title}</span>
        <span className={'text-caption font-normal text-muted-foreground'}>{props.note}</span>
    </h3>
);

/** What a part left out: the visitor should not read a shorter list as all there is. */
const missingNote = (shown: number, failed: number, total: number): string | undefined => {
    const parts = [failed > 0 ? `${failed} could not be bundled alone` : undefined, total - shown - failed > 0 ? `${total - shown - failed} not measured` : undefined].filter(
        (part) => part !== undefined,
    );
    return parts.length > 0 ? `${parts.join(', ')}.` : undefined;
};

type NamedExportsProps = { details: ExportDetails };

const NamedExports = (props: NamedExportsProps) => {
    const [filter, setFilter] = useState('');
    const [expanded, setExpanded] = useState(false);
    const needle = filter.trim().toLowerCase();
    const matching = useMemo(() => (needle === '' ? props.details.named : props.details.named.filter((part) => part.name.toLowerCase().includes(needle))), [props.details.named, needle]);
    const shown = expanded || needle !== '' ? matching : matching.slice(0, COLLAPSED);
    const missing = missingNote(props.details.named.length, props.details.namedFailed, props.details.namedTotal);

    return (
        <div className={'flex flex-col gap-2'}>
            <PartHeading
                title={'Named exports'}
                note={`${props.details.namedTotal} · largest first · gzip and minified`}
            />
            {props.details.named.length > COLLAPSED && (
                <>
                    <label
                        htmlFor={'export-filter'}
                        className={'sr-only'}
                    >
                        Filter exports by name
                    </label>
                    <Input
                        id={'export-filter'}
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        placeholder={'Filter by name'}
                        autoComplete={'off'}
                        spellCheck={false}
                        className={'my-2 h-10! max-w-xs text-callout!'}
                    />
                </>
            )}
            <ul className={'divide-y'}>
                {shown.map((part) => (
                    <PartRow
                        key={part.name}
                        name={part.name}
                        minified={part.minified}
                        gzip={part.gzip}
                    />
                ))}
            </ul>
            {needle !== '' && matching.length === 0 && <p className={'py-2 text-callout text-muted-foreground'}>No export has this name.</p>}
            {!expanded && needle === '' && matching.length > COLLAPSED && (
                <Button
                    variant={'secondary'}
                    className={'mt-2 w-fit'}
                    onClick={() => setExpanded(true)}
                >
                    Show all {matching.length}
                </Button>
            )}
            {missing !== undefined && <p className={'text-caption text-subtle-foreground'}>{missing}</p>}
        </div>
    );
};

type SubpathsProps = { details: ExportDetails };

const Subpaths = (props: SubpathsProps) => {
    const missing = missingNote(props.details.subpaths.length, props.details.subpathsFailed, props.details.subpathsTotal);
    const patterns = props.details.subpathPatterns;
    return (
        <div className={'flex flex-col gap-2'}>
            <PartHeading
                title={'Entry points'}
                note={'other paths in exports · gzip and minified'}
            />
            <ul className={'divide-y'}>
                {props.details.subpaths.map((part) => (
                    <PartRow
                        key={part.path}
                        name={part.path}
                        minified={part.minified}
                        gzip={part.gzip}
                    />
                ))}
            </ul>
            {missing !== undefined && <p className={'text-caption text-subtle-foreground'}>{missing}</p>}
            {patterns > 0 && <p className={'text-caption text-subtle-foreground'}>{patterns === 1 ? '1 wildcard path is' : `${patterns} wildcard paths are`} not measured one by one.</p>}
        </div>
    );
};

const treeShakingText = (details: ExportDetails): string => {
    if (details.format === 'commonjs') return 'This package is CommonJS: bundlers generally keep all of it, whichever part you import.';
    if (details.sideEffectsFree) return 'This package is made of ES modules and declares no side effects: bundlers can drop what you do not import.';
    return 'This package is made of ES modules, but does not declare that it has no side effects: bundlers may keep more than what you import.';
};

type ExportSizesProps = {
    exports: ExportsState;
    /** Whether the package itself can be imported. Without that, only its other entry points, if any, are worth a word. */
    hasEntry: boolean;
};

/** What importing only a part of the package costs. These numbers arrive after the main result, so the page says when they are on their way. */
export const ExportSizes = (props: ExportSizesProps) => {
    if (props.exports.status === 'pending') {
        return (
            <p
                role={'status'}
                className={'text-callout text-muted-foreground'}
            >
                Measuring each export…
            </p>
        );
    }
    if (props.exports.status === 'unavailable') {
        return <p className={'text-callout text-muted-foreground'}>The size of each export could not be measured for this package.</p>;
    }
    const details = props.exports.details;
    return (
        <div className={'flex flex-col gap-8'}>
            <div className={'flex flex-col gap-2'}>
                <p className={'max-w-2xl text-callout text-muted-foreground'}>
                    {props.hasEntry ? `${treeShakingText(details)} ` : ''}Each number is that part bundled alone; what parts share is counted once when you import several.
                </p>
            </div>
            {details.subpaths.length > 0 && <Subpaths details={details} />}
            {details.namedTotal > 0 && <NamedExports details={details} />}
        </div>
    );
};
