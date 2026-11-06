import type { AnalysisResult } from '@weighme/core';
import { Link } from '@tanstack/react-router';
import { formatSizeText } from '@lib/format';
import { HEADER_CELL, NUMBER_CELL, TEXT_CELL } from '@lib/tableClasses';

const formatShare = (share: number): string => (share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`);

const moduleCount = (count: number): string => `${count} ${count === 1 ? 'file' : 'files'}`;

type CompositionProps = {
    composition: AnalysisResult['composition'];
    /** The measured bundle: each share of it is an estimate, since the parts are only measured before minifying. */
    minified: number;
    packageName: string;
};

/** Which packages the bundle is made of, largest first. */
export const Composition = (props: CompositionProps) => {
    const { packages, total } = props.composition;
    const hidden = total - packages.length;
    const hiddenShare = Math.max(0, 1 - packages.reduce((sum, part) => sum + part.share, 0));

    return (
        <div className={'flex flex-col gap-4'}>
            <p className={'max-w-2xl text-callout text-muted-foreground'}>The packages inside the bundle. Sizes are estimated from each package&apos;s share of it.</p>
            {/* A named region the keyboard can reach: on a narrow screen the table scrolls sideways, and the arrow keys scroll it. */}
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div
                role={'region'}
                aria-label={'Packages in the bundle'}
                tabIndex={0}
                className={'overflow-x-auto'}
            >
                <table className={'w-full text-left text-callout'}>
                    <caption className={'sr-only'}>The packages in the bundle, largest first</caption>
                    <thead>
                        <tr className={'border-b'}>
                            <th
                                scope={'col'}
                                className={HEADER_CELL}
                            >
                                Package
                            </th>
                            <th
                                scope={'col'}
                                className={`${HEADER_CELL} hidden sm:table-cell`}
                            >
                                Files
                            </th>
                            <th
                                scope={'col'}
                                className={`${HEADER_CELL} text-right`}
                            >
                                Share
                            </th>
                            <th
                                scope={'col'}
                                className={`${HEADER_CELL} text-right`}
                            >
                                Minified, about
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {packages.map((part) => (
                            <tr
                                key={part.name}
                                className={'border-b last:border-0'}
                            >
                                <td className={`${TEXT_CELL} font-mono text-code break-all`}>
                                    {part.name === props.packageName ? (
                                        <>
                                            {part.name}
                                            <span className={'ml-2 font-sans text-caption text-subtle-foreground'}>its own code</span>
                                        </>
                                    ) : (
                                        <Link
                                            to={'/package/$'}
                                            params={{ _splat: part.name }}
                                            className={'text-link underline-offset-2 hover:underline'}
                                        >
                                            {part.name}
                                        </Link>
                                    )}
                                </td>
                                <td className={`${TEXT_CELL} hidden whitespace-nowrap text-muted-foreground sm:table-cell`}>{moduleCount(part.modules)}</td>
                                <td className={`${NUMBER_CELL} font-semibold`}>{formatShare(part.share)}</td>
                                <td className={`${NUMBER_CELL} text-muted-foreground`}>{formatSizeText(Math.round(part.share * props.minified))}</td>
                            </tr>
                        ))}
                        {hidden > 0 && (
                            <tr>
                                <td className={`${TEXT_CELL} text-muted-foreground`}>
                                    {hidden} more {hidden === 1 ? 'package' : 'packages'}
                                </td>
                                <td className={`${TEXT_CELL} hidden text-muted-foreground sm:table-cell`}>—</td>
                                <td className={`${NUMBER_CELL} font-semibold`}>{formatShare(hiddenShare)}</td>
                                <td className={`${NUMBER_CELL} text-muted-foreground`}>{formatSizeText(Math.round(hiddenShare * props.minified))}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
