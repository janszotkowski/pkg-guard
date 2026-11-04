import type { AnalysisResult } from '@pkg-guard/core';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { formatSizeText } from '@lib/format';

const formatShare = (share: number): string => (share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`);

type BarProps = { share: number; muted?: boolean };

/** Its part of the whole bundle, drawn from the same zero in every row. The number beside it says the same, so this is not read for values. */
const Bar = (props: BarProps) => (
    <div
        aria-hidden={'true'}
        className={'h-1.5 w-full'}
    >
        <div
            className={`h-full min-w-0.5 rounded-r-[4px] ${props.muted === true ? 'bg-subtle-foreground' : 'bg-bar'}`}
            style={{ width: `${props.share * 100}%` }}
        />
    </div>
);

type RowProps = { name: ReactNode; detail: string; share: number; minified: number; muted?: boolean };

const Row = (props: RowProps) => (
    <li className={'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 py-2.5'}>
        <span className={'flex min-w-0 flex-wrap items-baseline gap-x-2'}>
            <span className={'min-w-0 font-mono text-code break-all'}>{props.name}</span>
            <span className={'text-caption text-subtle-foreground'}>{props.detail}</span>
        </span>
        <span className={'flex items-baseline gap-4 tabular-nums'}>
            <span className={'text-callout font-semibold'}>{formatShare(props.share)}</span>
            <span className={'hidden w-20 text-right text-caption text-subtle-foreground sm:inline'}>≈ {formatSizeText(Math.round(props.share * props.minified))}</span>
        </span>
        <div className={'col-span-2'}>
            <Bar
                share={props.share}
                {...(props.muted === true ? { muted: true } : {})}
            />
        </div>
    </li>
);

const moduleCount = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`;

type CompositionProps = {
    composition: AnalysisResult['composition'];
    /** The measured bundle: each share of it is an estimate, since the parts are only measured before minifying. */
    minified: number;
    packageName: string;
};

/** Which packages the bundle is made of. With one package in it there is nothing to divide, and nothing to show. */
export const Composition = (props: CompositionProps) => {
    const { packages, total } = props.composition;
    if (total < 2) return null;
    const hidden = total - packages.length;
    const hiddenShare = Math.max(0, 1 - packages.reduce((sum, part) => sum + part.share, 0));

    return (
        <section
            aria-labelledby={'composition-title'}
            className={'flex flex-col gap-2'}
        >
            <h2
                id={'composition-title'}
                className={'flex flex-wrap items-baseline justify-between gap-x-4 border-b pb-2 text-headline'}
            >
                <span>What the bundle is made of</span>
                <span className={'text-caption font-normal text-muted-foreground'}>{total} packages · share of the bundle · estimated minified size</span>
            </h2>
            <ul className={'divide-y'}>
                {packages.map((part) => (
                    <Row
                        key={part.name}
                        name={
                            part.name === props.packageName ? (
                                part.name
                            ) : (
                                <Link
                                    to={'/package/$'}
                                    params={{ _splat: part.name }}
                                    className={'text-link underline-offset-2 hover:underline'}
                                >
                                    {part.name}
                                </Link>
                            )
                        }
                        detail={part.name === props.packageName ? `its own code · ${moduleCount(part.modules)}` : moduleCount(part.modules)}
                        share={part.share}
                        minified={props.minified}
                    />
                ))}
                {hidden > 0 && (
                    <Row
                        name={`${hidden} more ${hidden === 1 ? 'package' : 'packages'}`}
                        detail={'smaller than these'}
                        share={hiddenShare}
                        minified={props.minified}
                        muted
                    />
                )}
            </ul>
        </section>
    );
};
