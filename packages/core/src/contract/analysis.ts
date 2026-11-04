import * as z from 'zod/mini';

/**
 * Which way of measuring a stored result came from. Bump it when the bundler or its settings change: results of the old
 * value are no longer served, and each package is measured again the next time someone asks for it.
 */
export const ANALYZER_VERSION = 1;

export const packageRefSchema = z.object({ name: z.string(), version: z.string() });

export type PackageRef = z.infer<typeof packageRefSchema>;

/**
 * How the package is imported for measuring. ESM takes `export *`, which keeps its tree-shaking. CommonJS takes the
 * namespace: bundlers cannot see the exports of `export *` over CommonJS and would measure an empty module.
 */
export const ENTRY_KINDS = ['export-star', 'namespace'] as const;

export const analysisResultSchema = z.object({
    bundler: z.object({ name: z.string(), version: z.string() }),
    entry: z.enum(ENTRY_KINDS),
    /** Bytes of the minified bundle, without peer dependencies. */
    sizes: z.object({ minified: z.number(), gzip: z.number(), brotli: z.number() }),
    /** What an install puts on disk. */
    install: z.object({ bytes: z.number(), packages: z.number() }),
    peerDependencies: z.array(z.string()),
    timingsMs: z.object({ install: z.number(), bundle: z.number(), compress: z.number() }),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const FAILURE_CODES = ['INSTALL_FAILED', 'BUNDLE_FAILED', 'TOO_LARGE', 'TIMEOUT', 'INTERNAL'] as const;

export const analysisFailureSchema = z.object({ code: z.enum(FAILURE_CODES), message: z.string() });

export type AnalysisFailure = z.infer<typeof analysisFailureSchema>;

const base = { package: packageRefSchema, analyzerVersion: z.number() };

/** The answer of `GET /v1/analyses`: a queued or running analysis is asked for again until it is `done` or `failed`. */
export const analysisResponseSchema = z.discriminatedUnion('status', [
    z.object({ ...base, status: z.literal('queued') }),
    z.object({ ...base, status: z.literal('running') }),
    z.object({ ...base, status: z.literal('done'), result: analysisResultSchema }),
    z.object({ ...base, status: z.literal('failed'), failure: analysisFailureSchema }),
]);

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

/** One package for the worker to measure (`POST /internal/jobs/claim`). */
export const jobSchema = z.object({ id: z.number(), package: packageRefSchema });

export type Job = z.infer<typeof jobSchema>;

export const claimResponseSchema = z.object({ job: z.nullable(jobSchema) });
