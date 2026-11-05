import { ANALYZER_VERSION } from '../contract/analysis.ts';
import { errorResponseSchema, type ErrorCode } from '../contract/errors.ts';

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
const apiError = async (response: Response): Promise<ApiError> => {
    const failure = errorResponseSchema.safeParse(await response.json().catch(() => undefined));
    return failure.success ? new ApiError(failure.data.error.code, failure.data.error.message) : new ApiError('INTERNAL', `The API answered ${response.status}`);
};

/** The answer as the contract has it, or the API's error. */
export const answerOf = async <T>(response: Response, schema: { parse: (value: unknown) => T }): Promise<T> => {
    if (!response.ok) throw await apiError(response);
    return schema.parse(await response.json());
};

/**
 * The address of a package's analysis. The analyzer version keeps an answer measured the old way from being served, unread
 * by the API, after the way of measuring changes. With `known`, it reads only what has been measured and never queues a download.
 */
export const analysisPath = (spec: string, known = false): string => `/v1/analyses?package=${encodeURIComponent(spec)}${known ? '&known=1' : ''}&analyzer=${ANALYZER_VERSION}`;
