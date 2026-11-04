import { ANALYZER_VERSION, analysisResponseSchema, errorResponseSchema, searchResponseSchema, type AnalysisResponse, type ErrorCode, type PackageSuggestion } from '@pkg-guard/core';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { API_URL } from '@config/api';

const TIMEOUT_MS = 15_000;
const POLL_MS = 1000;

export class ApiError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
    }
}

export const fetchAnalysis = async (spec: string): Promise<AnalysisResponse> => {
    // A finished answer may be kept for a day, by the browser or a CDN. The analyzer version in the address keeps an answer
    // measured the old way from being served, unread by the API, after the way of measuring changes.
    const response = await fetch(`${API_URL}/v1/analyses?package=${encodeURIComponent(spec)}&analyzer=${ANALYZER_VERSION}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body: unknown = await response.json();
    if (response.ok) return analysisResponseSchema.parse(body);
    const failure = errorResponseSchema.safeParse(body);
    throw failure.success ? new ApiError(failure.data.error.code, failure.data.error.message) : new ApiError('INTERNAL', `The API answered ${response.status}`);
};

/** Nothing more will come: it failed, or everything has arrived, the part-by-part numbers included. */
const isSettled = (data: AnalysisResponse | undefined): boolean => data === undefined || data.status === 'failed' || (data.status === 'done' && data.exports.status !== 'pending');

/**
 * One package's analysis, asked for again while it is waiting or running. Once the first answer has named the exact
 * version, only that version is asked for: `latest` would have the backend ask the registry on every poll.
 */
export const analysisQuery = (spec: string) => {
    const queryKey = ['analysis', spec] as const;
    return queryOptions({
        queryKey,
        queryFn: ({ client }) => {
            const known = client.getQueryData<AnalysisResponse>(queryKey);
            return fetchAnalysis(known === undefined ? spec : `${known.package.name}@${known.package.version}`);
        },
        staleTime: 30_000,
        retry: false,
        refetchInterval: (query) => (isSettled(query.state.data) ? false : POLL_MS),
    });
};

const fetchSuggestions = async (query: string, signal: AbortSignal): Promise<PackageSuggestion[]> => {
    const response = await fetch(`${API_URL}/v1/search?q=${encodeURIComponent(query)}`, { signal });
    if (!response.ok) return [];
    return searchResponseSchema.parse(await response.json()).packages;
};

/** Packages offered while typing. Failing shows nothing: the name typed can still be looked up. What was offered stays until the next answer arrives. */
export const searchQuery = (query: string) =>
    queryOptions({
        queryKey: ['search', query],
        queryFn: ({ signal }) => fetchSuggestions(query, signal),
        staleTime: 5 * 60_000,
        retry: false,
        placeholderData: keepPreviousData,
    });
