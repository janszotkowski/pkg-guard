import { analysisResponseSchema, errorResponseSchema, type AnalysisResponse, type ErrorCode } from '@pkg-guard/core';
import { queryOptions } from '@tanstack/react-query';
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
    const response = await fetch(`${API_URL}/v1/analyses?package=${encodeURIComponent(spec)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body: unknown = await response.json();
    if (response.ok) return analysisResponseSchema.parse(body);
    const failure = errorResponseSchema.safeParse(body);
    throw failure.success ? new ApiError(failure.data.error.code, failure.data.error.message) : new ApiError('INTERNAL', `The API answered ${response.status}`);
};

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
        refetchInterval: (query) => (query.state.data?.status === 'queued' || query.state.data?.status === 'running' ? POLL_MS : false),
    });
};
