import type { AnalysisResult, HistoryResponse, PackageMetadata, PackageRef } from '@pkg-guard/core';
import { useQuery } from '@tanstack/react-query';
import { CopyButton } from '@components/CopyButton';
import { Notice } from '@components/Notice';
import { historyQuery, metadataQuery } from '@lib/api';
import { badgeMarkdown } from '@lib/documents/badge';
import { dayLabel } from '@lib/trends';

type Fact = { label: string; value: string; hint: string };

const WAITING = '…';

/** What a fact says when what it rests on could not be read: the other facts still stand. */
const unavailable = (label: string): Fact => ({ label, value: '—', hint: 'could not be loaded' });

const licenseFact = (metadata: PackageMetadata | undefined, failed: boolean): Fact => {
    const label = 'License';
    if (metadata === undefined) return failed ? unavailable(label) : { label, value: WAITING, hint: '' };
    return { label, value: metadata.license ?? 'Not stated', hint: 'as the package states it' };
};

const typesFact = (metadata: PackageMetadata | undefined, failed: boolean): Fact => {
    const label = 'TypeScript types';
    if (metadata === undefined) return failed ? unavailable(label) : { label, value: WAITING, hint: '' };
    if (metadata.types === 'included') return { label, value: 'Included', hint: 'declared by the package' };
    if (metadata.typesPackage !== null) return { label, value: 'Separate', hint: `in ${metadata.typesPackage}` };
    return { label, value: 'None declared', hint: 'and no @types package' };
};

const formatFact = (entry: AnalysisResult['entry']): Fact[] => {
    if (entry === null) return [];
    return [
        entry === 'export-star'
            ? { label: 'Module format', value: 'ES modules', hint: 'bundlers can drop what is unused' }
            : { label: 'Module format', value: 'CommonJS', hint: 'hard for bundlers to trim' },
    ];
};

/** The list of versions starts with the one `latest` points to. It comes from a large document, so it arrives last. */
const releaseFact = (history: HistoryResponse | undefined, failed: boolean): Fact => {
    const label = 'Last release';
    if (history === undefined && !failed) return { label, value: WAITING, hint: '' };
    const latest = history?.versions[0];
    if (latest === undefined || latest.publishedAt === null) return { label, value: '—', hint: 'npm did not say' };
    return { label, value: dayLabel(Date.parse(latest.publishedAt)), hint: `latest is ${latest.version}` };
};

const scriptsFact = (metadata: PackageMetadata | undefined, failed: boolean): Fact => {
    const label = 'Install scripts';
    if (metadata === undefined) return failed ? unavailable(label) : { label, value: WAITING, hint: '' };
    return { label, value: metadata.installScripts.length === 0 ? 'None' : metadata.installScripts.join(', '), hint: 'of this package, not its dependencies' };
};

type PackageHealthProps = { package: PackageRef; entry: AnalysisResult['entry'] };

/**
 * What to know about a package beside its size. It says what npm says and passes no judgement. A fact whose source could
 * not be read says so, and the others stand: the module format and the last release owe nothing to the metadata.
 */
export const PackageHealth = (props: PackageHealthProps) => {
    const { data, isError, isPending } = useQuery(metadataQuery(props.package.name, props.package.version));
    const history = useQuery(historyQuery(props.package.name));
    const facts: Fact[] = [licenseFact(data, isError), typesFact(data, isError), ...formatFact(props.entry), releaseFact(history.data, history.isError), scriptsFact(data, isError)];
    return (
        <section
            aria-labelledby={'package-health'}
            className={'flex flex-col gap-4'}
        >
            <h2
                id={'package-health'}
                className={'text-headline'}
            >
                Package health
            </h2>
            {data !== undefined && data.deprecated !== null && (
                <Notice tone={'danger'}>
                    <span className={'font-semibold text-destructive'}>Deprecated:</span> {data.deprecated}
                </Notice>
            )}
            <dl
                aria-busy={isPending}
                className={'grid grid-cols-2 gap-6 border-y py-6 md:grid-cols-3 lg:grid-cols-5'}
            >
                {facts.map((fact) => (
                    <div
                        key={fact.label}
                        className={'flex min-w-0 flex-col gap-1'}
                    >
                        <dt className={'text-callout font-semibold'}>{fact.label}</dt>
                        <dd className={'text-headline font-normal break-words'}>{fact.value}</dd>
                        {fact.hint !== '' && <dd className={'text-caption text-subtle-foreground'}>{fact.hint}</dd>}
                    </div>
                ))}
            </dl>
            <CopyButton
                className={'self-start'}
                variant={'outline'}
                label={'Copy README badge'}
                getText={() => badgeMarkdown(props.package.name)}
            />
        </section>
    );
};
