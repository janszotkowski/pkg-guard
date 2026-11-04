import { parseSpec, type AnalysisFailure } from '@pkg-guard/core';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { Composition } from '@components/Composition';
import { ExportSizes } from '@components/ExportSizes';
import { IsoAnalyzing } from '@components/iso/IsoAnalyzing';
import { IsoOffline } from '@components/iso/IsoOffline';
import { NotFound } from '@components/NotFound';
import { PackageLinks } from '@components/PackageLinks';
import { SizeResult } from '@components/SizeResult';
import { siteConfig } from '@config/site';
import { ApiError, analysisQuery } from '@lib/api';

const FAILURE_TEXT: Record<AnalysisFailure['code'], string> = {
    INSTALL_FAILED: 'The package could not be installed.',
    BUNDLE_FAILED: 'The package could not be bundled for the browser. It may need Node.js, or import something it does not declare.',
    TOO_LARGE: 'The package and its dependencies are too large to measure.',
    TIMEOUT: 'Measuring the package took too long.',
    INTERNAL: 'Something went wrong while measuring the package.',
};

type PendingProps = {
    status: 'queued' | 'running';
    /** The last time the page asked, it got no usable answer: what it shows may be out of date. */
    stalled: boolean;
};

const pendingText = (props: PendingProps): string => {
    if (props.stalled) return 'Could not get an update from the server. Still trying…';
    return props.status === 'queued' ? 'Waiting for a free worker…' : 'Installing and bundling the package…';
};

/** The analysis runs in the worker; the page asks again every second until it has an answer. */
const Pending = (props: PendingProps) => (
    <div
        role={'status'}
        className={'flex w-full flex-col items-center gap-4'}
    >
        <IsoAnalyzing className={'h-auto w-full max-w-sm'} />
        <p className={'text-callout text-muted-foreground'}>{pendingText(props)}</p>
    </div>
);

type FailedProps = { failure: AnalysisFailure };

const Failed = (props: FailedProps) => (
    <div className={'flex w-full flex-col items-center gap-4'}>
        <IsoOffline className={'h-auto w-full max-w-64'} />
        <p className={'text-headline'}>{FAILURE_TEXT[props.failure.code]}</p>
        <pre className={'max-w-full overflow-auto text-left text-code whitespace-pre-wrap text-muted-foreground'}>{props.failure.message}</pre>
    </div>
);

const PackagePage = () => {
    const spec = Route.useParams()._splat ?? '';
    const { data, isRefetchError } = useSuspenseQuery(analysisQuery(spec));
    // While there is nothing to read yet, the page holds one thing, in its middle.
    const finished = data.status === 'done';

    return (
        <main
            id={'main'}
            tabIndex={-1}
            className={
                finished
                    ? 'mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:py-14'
                    : 'mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-14 text-center'
            }
        >
            <div className={finished ? 'flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2' : 'flex flex-col items-center gap-2'}>
                <h1 className={'min-w-0 text-title-1 break-words'}>
                    {data.package.name}
                    <span className={'text-muted-foreground'}>@{data.package.version}</span>
                </h1>
                <PackageLinks
                    package={data.package}
                    repositoryUrl={finished ? data.result.repositoryUrl : undefined}
                />
                {finished && data.result.description !== null && <p className={'w-full max-w-3xl text-headline font-normal text-muted-foreground'}>{data.result.description}</p>}
            </div>
            {(data.status === 'queued' || data.status === 'running') && (
                <Pending
                    status={data.status}
                    stalled={isRefetchError}
                />
            )}
            {data.status === 'done' && (
                <>
                    <SizeResult result={data.result} />
                    {data.result.sizes !== null && (
                        <Composition
                            composition={data.result.composition}
                            minified={data.result.sizes.minified}
                            packageName={data.package.name}
                        />
                    )}
                    <ExportSizes
                        exports={data.exports}
                        hasEntry={data.result.sizes !== null}
                    />
                </>
            )}
            {data.status === 'failed' && <Failed failure={data.failure} />}
        </main>
    );
};

export const Route = createFileRoute('/package/$')({
    loader: async ({ params, context }) => {
        const spec = params._splat ?? '';
        if (parseSpec(spec) === undefined) throw notFound();
        try {
            await context.queryClient.ensureQueryData(analysisQuery(spec));
        } catch (error) {
            if (error instanceof ApiError && error.code === 'NOT_FOUND') throw notFound();
            throw error;
        }
    },
    head: ({ params }) => ({ meta: [{ title: `${params._splat ?? 'Package'} | ${siteConfig.title}` }] }),
    component: PackagePage,
    notFoundComponent: () => (
        <NotFound
            title={'Package not found'}
            message={'npm has no package or version by this name.'}
            label={'Not on npm'}
        />
    ),
});
