import * as z from 'zod/mini';

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 100;

/** A package offered while someone types. It is only a name to pick: looking it up is what measures it. */
export const packageSuggestionSchema = z.object({
    name: z.string(),
    version: z.string(),
    description: z.nullable(z.string()),
    weeklyDownloads: z.nullable(z.number()),
});

export type PackageSuggestion = z.infer<typeof packageSuggestionSchema>;

/** The answer of `GET /v1/search`. */
export const searchResponseSchema = z.object({ packages: z.array(packageSuggestionSchema) });

export type SearchResponse = z.infer<typeof searchResponseSchema>;
