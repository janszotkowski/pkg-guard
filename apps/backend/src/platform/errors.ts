import type { ErrorCode, ErrorResponse } from '@pkg-guard/core';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** One field's problem, for `VALIDATION_FAILED`. */
export type ErrorDetail = { path: string; message: string };

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
    VALIDATION_FAILED: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    UNAVAILABLE: 503,
    INTERNAL: 500,
};

/** A failure the API answers with its own code; anything else thrown becomes INTERNAL. */
export class AppError extends Error {
    readonly code: ErrorCode;
    readonly details: ErrorDetail[] | undefined;
    /** Seconds until a retry can succeed, sent as `Retry-After`; `UNAVAILABLE` has a default when none is given. */
    readonly retryAfterSec: number | undefined;

    constructor(code: ErrorCode, message: string, details?: ErrorDetail[], retryAfterSec?: number) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
        this.retryAfterSec = retryAfterSec;
    }
}

/** The HTTP status each code is answered with. */
export const statusOf = (code: ErrorCode): ContentfulStatusCode => STATUS[code];

/** The body of every error answer, in the shape of the contract. */
export const errorBody = (code: ErrorCode, message: string, requestId?: string, details?: ErrorDetail[]): ErrorResponse => ({
    error: { code, message, ...(requestId === undefined ? {} : { requestId }), ...(details === undefined ? {} : { details }) },
});
