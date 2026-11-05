import {
    ANALYZER_VERSION,
    analysisResponseSchema,
    errorResponseSchema,
    downloadsResponseSchema,
    historyResponseSchema,
    isComplete,
    packageMetadataSchema,
    packagesResponseSchema,
    searchResponseSchema,
    starsResponseSchema,
    type AnalysisResponse,
    type ErrorCode,
    type HistoryResponse,
    type PackageSuggestion,
    type PackagesResponse,
    type TrendRange,
} from '@pkg-guard/core';
import { keepPreviousData, queryOptions, type QueryState } from '@tanstack/react-query';
import { apiBaseUrl, internalApiHeaders } from '@config/api';

/** No request waits longer than this, whatever asked for it: a stuck API is told apart from a slow one. */
const TIMEOUT_MS = 15_000;
/** While a package is queued or running its sizes can arrive any second; the part-by-part numbers take longer, and the page already shows the sizes. */
const POLL_MS = 1000;
const EXPORTS_POLL_MS = 2000;
const HISTORY_POLL_MS = 2000;
/** Once a poll has failed the next ones come slower, and after this many in a row they stop: the API is not coming back on its own. */
const FAILED_POLL_MS = 5000;
const MAX_POLL_FAILURES = 6;

export class ApiError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
    }
}

/**
 * One request to the API: from the browser at its public address, from the server at its internal one, saying whom the
 * page is for. It gives up after `TIMEOUT_MS`, or sooner when the caller's own signal (a query cancelled, a page left) says so.
 */
const api = (path: string, init: { method?: 'POST'; signal?: AbortSignal | undefined } = {}): Promise<Response> => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = init.signal === undefined ? timeout : AbortSignal.any([init.signal, timeout]);
    return fetch(`${apiBaseUrl()}${path}`, { ...init, signal, headers: internalApiHeaders() });
};

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

/** The API's own error when it sent one, else what little the status says: a proxy's error page is not JSON. */
const apiError = async (response: Response): Promise<ApiError> => {
    const failure = errorResponseSchema.safeParse(await response.json().catch(() => undefined));
    return failure.success ? new ApiError(failure.data.error.code, failure.data.error.message) : new ApiError('INTERNAL', `The API answered ${response.status}`);
};

/** The answer as the contract has it, or the API's error. */
const answerOf = async <T>(response: Response, schema: { parse: (value: unknown) => T }): Promise<T> => {
    if (!response.ok) throw await apiError(response);
    return schema.parse(await response.json());
};

// A finished answer may be kept for a day, by the browser or a CDN. The analyzer version in the address keeps an answer
// measured the old way from being served, unread by the API, after the way of measuring changes.
export const fetchAnalysis = async (spec: string, signal?: AbortSignal): Promise<AnalysisResponse> =>
    answerOf(await api(`/v1/analyses?package=${encodeURIComponent(spec)}&analyzer=${ANALYZER_VERSION}`, { signal }), analysisResponseSchema);

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

const fetchSuggestions = async (query: string, signal: AbortSignal): Promise<PackageSuggestion[]> => {
    const response = await api(`/v1/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) return [];
    return searchResponseSchema.parse(await response.json()).packages;
};

/** Packages offered while typing. Failing shows nothing: the name typed can still be looked up. What was offered stays until the next answer arrives. */
export const searchQuery = (query: string) =>
    queryOptions({
        queryKey: ['search', query],
        queryFn: ({ signal }) => fetchSuggestions(query, signal),
        staleTime: 5 * 60_000,
        placeholderData: keepPreviousData,
    });

/** A package's recent versions, asked for again while any of them is being measured. Reading this downloads nothing. */
export const historyQuery = (name: string) =>
    queryOptions({
        queryKey: ['history', name],
        queryFn: async ({ signal }) => answerOf(await api(`/v1/history?package=${encodeURIComponent(name)}`, { signal }), historyResponseSchema),
        refetchInterval: (query) => pollInterval(query, query.state.data?.versions.some((entry) => entry.status === 'queued' || entry.status === 'running') === true ? HISTORY_POLL_MS : false),
    });

/** Queues every version not yet measured. Each of them will be downloaded, in the worker's own container. */
export const measureHistory = async (name: string): Promise<HistoryResponse> => answerOf(await api(`/v1/history?package=${encodeURIComponent(name)}`, { method: 'POST' }), historyResponseSchema);

/** A package's downloads per day. npm updates them once a day, so they are kept for a while. */
export const downloadsQuery = (name: string, range: TrendRange) =>
    queryOptions({
        queryKey: ['downloads', name, range],
        queryFn: async ({ signal }) => answerOf(await api(`/v1/downloads?package=${encodeURIComponent(name)}&range=${range}`, { signal }), downloadsResponseSchema),
        staleTime: 30 * 60_000,
    });

/** A repository's stars, once its package has named one. */
export const starsQuery = (repository: string | undefined) =>
    queryOptions({
        queryKey: ['stars', repository],
        enabled: repository !== undefined,
        queryFn: async ({ signal }) => answerOf(await api(`/v1/stars?repository=${encodeURIComponent(repository ?? '')}`, { signal }), starsResponseSchema),
        staleTime: 60 * 60_000,
    });

/** What npm says about one version. It comes from the registry, so reading it downloads no package. */
export const metadataQuery = (name: string, version: string) =>
    queryOptions({
        queryKey: ['metadata', name, version],
        queryFn: async ({ signal }) => answerOf(await api(`/v1/metadata?package=${encodeURIComponent(`${name}@${version}`)}`, { signal }), packageMetadataSchema),
        staleTime: 30 * 60_000,
    });

/** A package only if it has been measured: what documents for crawlers read, so that they never cause a download. Undefined when it has not. */
export const fetchKnownAnalysis = async (spec: string): Promise<AnalysisResponse | undefined> => {
    const response = await api(`/v1/analyses?package=${encodeURIComponent(spec)}&known=1&analyzer=${ANALYZER_VERSION}`);
    if (response.status === 404) return undefined;
    return answerOf(response, analysisResponseSchema);
};

/** Every measured package, for the sitemap. */
export const fetchMeasuredPackages = async (): Promise<PackagesResponse['packages']> => (await answerOf(await api('/v1/packages'), packagesResponseSchema)).packages;
