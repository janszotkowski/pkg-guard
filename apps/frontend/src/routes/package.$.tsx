import { parseSpec, type AnalysisFailure, type AnalysisResponse } from '@pkg-guard/core';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Composition } from '@components/Composition';
import { ExportSizes } from '@components/ExportSizes';
import { IsoAnalyzing } from '@components/iso/IsoAnalyzing';
import { IsoOffline } from '@components/iso/IsoOffline';
import { NotFound } from '@components/NotFound';
import { PackageLinks, npmUrl } from '@components/PackageLinks';
import { PACKAGE_TABS, PackageTabs, type PackageTab } from '@components/PackageTabs';
import { SizeResult } from '@components/SizeResult';
import { VersionHistory } from '@components/VersionHistory';
import { canonicalUrl, siteConfig } from '@config/site';
import { ApiError, analysisQuery } from '@lib/api';
import { formatSizeText } from '@lib/format';
import { clip, pageHead } from '@lib/head';

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

type PackageDetailsProps = { data: Extract<AnalysisResponse, { status: 'done' }>; tab: PackageTab | undefined; onTab: (tab: PackageTab) => void };

/** What there is to look into for this package, one tab at a time. A tab with nothing in it is not offered. */
const PackageDetails = (props: PackageDetailsProps) => {
    const { data } = props;
    const { result, exports } = data;
    const sizes = result.sizes;
    const tabs = useMemo(() => {
        const details = exports.status === 'done' ? exports.details : undefined;
        return [
            ...(sizes === null
                ? []
                : [
                      {
                          value: 'history' as const,
                          label: 'History',
                          content: (
                              <VersionHistory
                                  name={data.package.name}
                                  version={data.package.version}
                              />
                          ),
                      },
                  ]),
            ...(sizes === null || result.composition.total < 2
                ? []
                : [
                      {
                          value: 'composition' as const,
                          label: `Composition · ${result.composition.total}`,
                          content: (
                              <Composition
                                  composition={result.composition}
                                  minified={sizes.minified}
                                  packageName={data.package.name}
                              />
                          ),
                      },
                  ]),
            ...(sizes === null && (details === undefined || details.subpaths.length === 0)
                ? []
                : [
                      {
                          value: 'exports' as const,
                          label: details === undefined || details.namedTotal === 0 ? 'Exports' : `Exports · ${details.namedTotal}`,
                          content: (
                              <ExportSizes
                                  exports={exports}
                                  hasEntry={sizes !== null}
                              />
                          ),
                      },
                  ]),
        ];
    }, [data.package.name, data.package.version, exports, result.composition, sizes]);
    const first = tabs[0];
    if (first === undefined) return null;
    return (
        <PackageTabs
            tabs={tabs}
            value={tabs.find((tab) => tab.value === props.tab)?.value ?? first.value}
            onChange={props.onTab}
        />
    );
};

const PackagePage = () => {
    const spec = Route.useParams()._splat ?? '';
    const { tab } = Route.useSearch();
    const navigate = useNavigate({ from: '/package/$' });
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
                    <PackageDetails
                        data={data}
                        tab={tab}
                        onTab={(next) => {
                            void navigate({ search: { tab: next }, resetScroll: false, replace: true });
                        }}
                    />
                </>
            )}
            {data.status === 'failed' && <Failed failure={data.failure} />}
        </main>
    );
};

/**
 * The page of a package. Only a measured package at its own address (no version in it) is listed: a page still being
 * measured says nothing yet, and every version of every package would bury the page people search for.
 */
const packageHead = (spec: string, data: AnalysisResponse | undefined) => {
    const path = `/package/${spec}`;
    const parsed = parseSpec(spec);
    const name = data?.package.name ?? parsed?.name ?? spec;
    const result = data?.status === 'done' ? data.result : undefined;
    const sizes = result?.sizes;
    const text =
        result === undefined
            ? `What ${name} costs your bundle: minified, gzip and brotli size, measured with a modern bundler.`
            : sizes === undefined || sizes === null
              ? `${name} ${data?.package.version}: ${formatSizeText(result.install.bytes)} on disk. ${result.description ?? ''}`
              : `${name} ${data?.package.version}: ${formatSizeText(sizes.gzip)} minified and gzipped, ${formatSizeText(sizes.minified)} minified. ${result.description ?? ''}`;
    return pageHead({
        title: sizes === undefined || sizes === null ? `${name} size` : `${name} size: ${formatSizeText(sizes.gzip)} gzip`,
        description: clip(text),
        path,
        noindex: result === undefined || parsed?.version !== undefined,
        ...(result === undefined
            ? {}
            : { ogImage: { path: `/og/package/${spec}.png`, alt: `${name}: ${sizes === undefined || sizes === null ? 'install size' : `${formatSizeText(sizes.gzip)} minified and gzipped`}` } }),
        breadcrumbs: [
            { name: siteConfig.title, path: '/' },
            { name, path },
        ],
        nodes:
            result === undefined || data === undefined
                ? []
                : [
                      {
                          '@type': 'SoftwareSourceCode',
                          '@id': `${canonicalUrl(path)}#package`,
                          name,
                          version: data.package.version,
                          programmingLanguage: 'JavaScript',
                          runtimePlatform: 'npm',
                          url: npmUrl(data.package),
                          ...(result.description === null ? {} : { description: result.description }),
                          ...(result.repositoryUrl === null ? {} : { codeRepository: result.repositoryUrl }),
                      },
                  ],
    });
};

export const Route = createFileRoute('/package/$')({
    validateSearch: (search: Record<string, unknown>): { tab?: PackageTab } => {
        const tab = PACKAGE_TABS.find((candidate) => candidate === search['tab']);
        return tab === undefined ? {} : { tab };
    },
    loader: async ({ params, context }) => {
        const spec = params._splat ?? '';
        if (parseSpec(spec) === undefined) throw notFound();
        try {
            return await context.queryClient.ensureQueryData(analysisQuery(spec));
        } catch (error) {
            if (error instanceof ApiError && error.code === 'NOT_FOUND') throw notFound();
            throw error;
        }
    },
    head: ({ params, loaderData }) => packageHead(params._splat ?? '', loaderData),
    component: PackagePage,
    notFoundComponent: () => (
        <NotFound
            title={'Package not found'}
            message={'npm has no package or version by this name.'}
            label={'Not on npm'}
        />
    ),
});
