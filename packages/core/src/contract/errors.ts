import * as z from 'zod/mini';

/** Stable error codes of the HTTP API. `UNAVAILABLE` means the queue is full or the registry did not answer: worth retrying later. */
export const ERROR_CODES = ['VALIDATION_FAILED', 'UNAUTHORIZED', 'NOT_FOUND', 'UNAVAILABLE', 'INTERNAL'] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
    error: z.object({
        code: errorCodeSchema,
        /** English, for logs and developers. */
        message: z.string(),
        requestId: z.optional(z.string()),
    }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
