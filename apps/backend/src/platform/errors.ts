import type { ErrorCode, ErrorResponse } from '@pkg-guard/core';

const STATUS: Record<ErrorCode, 400 | 401 | 404 | 500 | 503> = {
    VALIDATION_FAILED: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    UNAVAILABLE: 503,
    INTERNAL: 500,
};

/** A failure the API answers with its own code; anything else thrown becomes INTERNAL. */
export class AppError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = 'AppError';
        this.code = code;
    }
}

export const statusOf = (code: ErrorCode): 400 | 401 | 404 | 500 | 503 => STATUS[code];

export const errorBody = (code: ErrorCode, message: string, requestId?: string): ErrorResponse => ({
    error: { code, message, ...(requestId === undefined ? {} : { requestId }) },
});
