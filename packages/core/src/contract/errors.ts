import * as z from 'zod/mini';

/**
 * Stable error codes of the HTTP API. `UNAVAILABLE` means the queue is full or the registry did not answer: worth retrying
 * later. `RATE_LIMITED` means this caller asked too often: the answer says in `Retry-After` when to ask again.
 */
export const ERROR_CODES = ['VALIDATION_FAILED', 'UNAUTHORIZED', 'NOT_FOUND', 'RATE_LIMITED', 'UNAVAILABLE', 'INTERNAL'] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
    error: z.object({
        code: errorCodeSchema,
        /** English, for logs and developers. */
        message: z.string(),
        requestId: z.optional(z.string()),
        /** Field-level problems for `VALIDATION_FAILED`. */
        details: z.optional(z.array(z.object({ path: z.string(), message: z.string() }))),
    }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
