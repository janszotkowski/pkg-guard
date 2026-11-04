import * as z from 'zod/mini';

/** How far back downloads are asked for, in the address and the API. */
export const TREND_RANGES = ['2m', '1y', '3y'] as const;

export type TrendRange = (typeof TREND_RANGES)[number];

export const TREND_RANGE_DAYS: Record<TrendRange, number> = { '2m': 62, '1y': 365, '3y': 1095 };

/** The answer of `GET /v1/downloads`: one row per day, oldest first, in UTC. */
export const downloadsResponseSchema = z.object({
    name: z.string(),
    days: z.array(z.object({ day: z.string(), downloads: z.number() })),
});

export type DownloadsResponse = z.infer<typeof downloadsResponseSchema>;

/** The answer of `GET /v1/stars`. Null when GitHub did not say. It is today's number: GitHub keeps no history of it to ask for. */
export const starsResponseSchema = z.object({ stars: z.nullable(z.number()) });
