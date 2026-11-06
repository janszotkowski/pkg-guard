import {
    ApiError,
    createApiClient,
    isComplete,
    type AnalysisResponse,
    type ApiClient,
    type DownloadsResponse,
    type HistoryResponse,
    type PackageMetadata,
    type PackageSuggestion,
    type PackagesResponse,
    type TrendRange,
} from '@weighme/core';
import { keepPreviousData, queryOptions, type QueryState } from '@tanstack/react-query';
import { apiBaseUrl, internalApiHeaders } from '@config/api';

/** While a package is queued or running its sizes can arrive any second; the part-by-part numbers take longer, and the page already shows the sizes. */
const POLL_MS = 1000;
const EXPORTS_POLL_MS = 2000;
const HISTORY_POLL_MS = 2000;
/** Once a poll has failed the next ones come slower, and after this many in a row they stop: the API is not coming back on its own. */
const FAILED_POLL_MS = 5000;
const MAX_POLL_FAILURES = 6;

export { ApiError } from '@weighme/core';

/**
 * The one way the frontend talks to the backend: the typed client from core. Made per call: from the browser it asks at
 * the public address, from the server at its internal one, saying whom the page is for.
 */
const createApi = (): ApiClient => createApiClient({ baseUrl: apiBaseUrl(), headers: internalApiHeaders() });

type PollState = Pick<QueryState, 'status' | 'dataUpdateCount' | 'errorUpdateCount'>;

/** Per query, how many answers and how many failures it had when it last answered: TanStack Query counts both, but only all-time. */
const atLastAnswer = new WeakMap<object, { answers: number; errors: number }>();

/** How many fetches of the query have failed since the last one that answered. */
const failuresInARow = (query: object, state: PollState): number => {
    const seen = atLastAnswer.get(query);
    if (seen === undefined || seen.answers !== state.dataUpdateCount) {
        atLastAnswer.set(query, { answers: state.dataUpdateCount, errors: state.errorUpdateCount });
        return 0;
    }
    return state.errorUpdateCount - seen.errors;
};

/**
 * How soon to ask again: `normal` while the answers come, slower once the last fetch failed, and not at all after
 * `MAX_POLL_FAILURES` failures in a row. The page keeps what it has, and the query is tried again when it is asked for.
 */
export const pollInterval = (query: { state: PollState }, normal: number | false): number | false => {
    if (normal === false) return false;
    const failures = failuresInARow(query, query.state);
    if (failures >= MAX_POLL_FAILURES) return false;
    return failures > 0 || query.state.status === 'error' ? FAILED_POLL_MS : normal;
};

// A finished answer may be kept for a day, by the browser or a CDN.
export const fetchAnalysis = (spec: string, signal?: AbortSignal): Promise<AnalysisResponse> => createApi().analysis(spec, { signal });

/**
 * One package's analysis, asked for again while it is waiting or running. Once the first answer has named the exact
 * version, only that version is asked for: `latest` would have the backend ask the registry on every poll.
 */
export const analysisQuery = (spec: string) => {
    const queryKey = ['analysis', spec] as const;
    return queryOptions({
        queryKey,
        queryFn: ({ client, signal }) => {
            const known = client.getQueryData<AnalysisResponse>(queryKey);
            return fetchAnalysis(known === undefined ? spec : `${known.package.name}@${known.package.version}`, signal);
        },
        refetchInterval: (query) => {
            const data = query.state.data;
            // Nothing more will come: it failed, or everything has arrived, the part-by-part numbers included.
            if (data === undefined || data.status === 'failed' || isComplete(data)) return false;
            return pollInterval(query, data.status === 'done' ? EXPORTS_POLL_MS : POLL_MS);
        },
    });
};

/** Packages matching a text. Failing is no answer at all, which is what the page shows then too. */
export const fetchSuggestions = async (query: string, signal?: AbortSignal): Promise<PackageSuggestion[]> => {
    try {
        return await createApi().search(query, { signal });
    } catch (error) {
        if (error instanceof ApiError) return [];
        throw error;
    }
};

/** Packages offered while typing. Failing shows nothing: the name typed can still be looked up. What was offered stays until the next answer arrives. */
export const searchQuery = (query: string) =>
    queryOptions({
        queryKey: ['search', query],
        queryFn: ({ signal }) => fetchSuggestions(query, signal),
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
    });

/** A package's recent versions. Reading this downloads nothing. */
export const fetchHistory = (name: string, signal?: AbortSignal): Promise<HistoryResponse> => createApi().history(name, { signal });

/** A package's recent versions, asked for again while any of them is being measured. Reading this downloads nothing. */
export const historyQuery = (name: string) =>
    queryOptions({
        queryKey: ['history', name],
        queryFn: ({ signal }) => fetchHistory(name, signal),
        refetchInterval: (query) => pollInterval(query, query.state.data?.versions.some((entry) => entry.status === 'queued' || entry.status === 'running') === true ? HISTORY_POLL_MS : false),
    });

/** Queues every version not yet measured. Each of them will be downloaded, in the worker's own container. */
export const measureHistory = (name: string): Promise<HistoryResponse> => createApi().measureHistory(name);

/** A package's downloads per day, from npm. */
export const fetchDownloads = (name: string, range: TrendRange, signal?: AbortSignal): Promise<DownloadsResponse> => createApi().downloads(name, range, { signal });

/** A package's downloads per day. npm updates them once a day, so they are kept for a while. */
export const downloadsQuery = (name: string, range: TrendRange) =>
    queryOptions({
        queryKey: ['downloads', name, range],
        queryFn: ({ signal }) => fetchDownloads(name, range, signal),
        staleTime: 30 * 60_000,
    });

/** A repository's stars, once its package has named one. */
export const starsQuery = (repository: string | undefined) =>
    queryOptions({
        queryKey: ['stars', repository],
        enabled: repository !== undefined,
        queryFn: async ({ signal }) => ({ stars: await createApi().stars(repository ?? '', { signal }) }),
        staleTime: 60 * 60_000,
    });

/** What the registry says of one exact version. */
export const fetchMetadata = (name: string, version: string, signal?: AbortSignal): Promise<PackageMetadata> => createApi().metadata(name, version, { signal });

/** What npm says about one version. It comes from the registry, so reading it downloads no package. */
export const metadataQuery = (name: string, version: string) =>
    queryOptions({
        queryKey: ['metadata', name, version],
        queryFn: ({ signal }) => fetchMetadata(name, version, signal),
        staleTime: 30 * 60_000,
    });

/** A package only if it has been measured: what documents for crawlers read, so that they never cause a download. Undefined when it has not. */
export const fetchKnownAnalysis = (spec: string): Promise<AnalysisResponse | undefined> => createApi().knownAnalysis(spec);

/** Every measured package, for the sitemap. */
export const fetchMeasuredPackages = (): Promise<PackagesResponse['packages']> => createApi().packages();
