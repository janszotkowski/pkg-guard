import { ANALYZER_VERSION, analysisResponseSchema, packagesResponseSchema, type AnalysisResponse, type PackagesResponse } from '../contract/analysis.ts';
import { errorResponseSchema, type ErrorCode } from '../contract/errors.ts';
import { historyResponseSchema, type HistoryResponse } from '../contract/history.ts';
import { packageMetadataSchema, type PackageMetadata } from '../contract/metadata.ts';
import { searchResponseSchema, type PackageSuggestion } from '../contract/search.ts';
import { downloadsResponseSchema, starsResponseSchema, type DownloadsResponse, type TrendRange } from '../contract/trends.ts';

/** A failed answer of the API, with its stable code. */
export class ApiError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
    }
}

/** The API's own error when it sent one, else what little the status says: a proxy's error page is not JSON. */
const errorOf = async (response: Response): Promise<ApiError> => {
    const failure = errorResponseSchema.safeParse(await response.json().catch(() => undefined));
    return failure.success ? new ApiError(failure.data.error.code, failure.data.error.message) : new ApiError('INTERNAL', `The API answered ${response.status}`);
};

/**
 * The address of a package's analysis. The analyzer version keeps an answer measured the old way from being served, unread
 * by the API, after the way of measuring changes. With `known`, it reads only what has been measured and never queues a download.
 */
export const analysisPath = (spec: string, known = false): string => `/v1/analyses?package=${encodeURIComponent(spec)}${known ? '&known=1' : ''}&analyzer=${ANALYZER_VERSION}`;

/** No request waits longer than this, whatever asked for it: a stuck API is told apart from a slow one. */
export const REQUEST_TIMEOUT_MS = 15_000;

export type ApiClientOptions = {
    /** Where the API is, without the `/v1` that is part of the contract. */
    baseUrl: string;
    /** Defaults to the global `fetch`. Tests pass their own. */
    fetch?: typeof fetch;
    /** Sent with every request, such as the frontend server's `x-internal-token`. */
    headers?: Record<string, string>;
};

/** Per call: `signal` gives up on the request, so an answer nobody waits for any more is not downloaded. */
export type CallOptions = { signal?: AbortSignal | undefined };

type Schema<T> = { safeParse: (value: unknown) => { success: true; data: T } | { success: false } };

/**
 * The one typed way to call the API, for the site and the command line alike. Every answer is checked against the
 * contract: what comes out is what the types say, or an `ApiError`.
 */
export const createApiClient = (options: ApiClientOptions) => {
    const doFetch: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    const baseUrl = options.baseUrl.replace(/\/+$/, '');

    const request = async <T>(method: 'GET' | 'POST', path: string, schema: Schema<T>, call: CallOptions = {}): Promise<T> => {
        const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
        const response = await doFetch(`${baseUrl}${path}`, {
            method,
            headers: { Accept: 'application/json', ...options.headers },
            signal: call.signal === undefined ? timeout : AbortSignal.any([call.signal, timeout]),
        });
        if (!response.ok) throw await errorOf(response);
        const parsed = schema.safeParse(await response.json().catch(() => undefined));
        // The server answered, but not with the contract: a bug on one side.
        if (!parsed.success) throw new ApiError('INTERNAL', `The answer of ${path} does not match the contract`);
        return parsed.data;
    };

    const named = (name: string): string => encodeURIComponent(name);

    return {
        /** What a package costs. One not measured yet is queued, and the answer says so. */
        analysis: (spec: string, call?: CallOptions): Promise<AnalysisResponse> => request('GET', analysisPath(spec), analysisResponseSchema, call),
        /** A package only if it has been measured, so asking never causes a download. Undefined when it has not. */
        knownAnalysis: async (spec: string, call?: CallOptions): Promise<AnalysisResponse | undefined> => {
            try {
                return await request('GET', analysisPath(spec, true), analysisResponseSchema, call);
            } catch (error) {
                if (error instanceof ApiError && error.code === 'NOT_FOUND') return undefined;
                throw error;
            }
        },
        /** Recent versions of a package. Reading this downloads nothing. */
        history: (name: string, call?: CallOptions): Promise<HistoryResponse> => request('GET', `/v1/history?package=${named(name)}`, historyResponseSchema, call),
        /** Queues every version not yet measured. Each of them will be downloaded, in the worker's own container. */
        measureHistory: (name: string, call?: CallOptions): Promise<HistoryResponse> => request('POST', `/v1/history?package=${named(name)}`, historyResponseSchema, call),
        /** A package's downloads per day, from npm. */
        downloads: (name: string, range: TrendRange, call?: CallOptions): Promise<DownloadsResponse> =>
            request('GET', `/v1/downloads?package=${named(name)}&range=${range}`, downloadsResponseSchema, call),
        /** What the registry says of one exact version. Nothing is downloaded for it. */
        metadata: (name: string, version: string, call?: CallOptions): Promise<PackageMetadata> => request('GET', `/v1/metadata?package=${named(`${name}@${version}`)}`, packageMetadataSchema, call),
        /** A repository's stars on GitHub. Null when GitHub did not say. */
        stars: async (repository: string, call?: CallOptions): Promise<number | null> => (await request('GET', `/v1/stars?repository=${named(repository)}`, starsResponseSchema, call)).stars,
        /** Packages matching a text: names and descriptions only, nothing is installed. */
        search: async (query: string, call?: CallOptions): Promise<PackageSuggestion[]> => (await request('GET', `/v1/search?q=${named(query)}`, searchResponseSchema, call)).packages,
        /** Every package with a finished measurement. */
        packages: async (call?: CallOptions): Promise<PackagesResponse['packages']> => (await request('GET', '/v1/packages', packagesResponseSchema, call)).packages,
    };
};

export type ApiClient = ReturnType<typeof createApiClient>;
