import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** The value in `.env.example`. It is public, so it is fine on a laptop and refused in production. */
const EXAMPLE_WORKER_TOKEN = 'local-development-only-not-a-secret';

/**
 * Every setting the backend reads from the environment, validated once at start-up. Nothing else reads `process.env`:
 * a missing or malformed value stops the process with a readable message instead of failing later.
 */
const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        HOST: z.string().min(1).default('127.0.0.1'),
        PORT: z.coerce.number().int().min(1).max(65535).default(4100),
        LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
        APP_VERSION: z.string().min(1).default('dev'),
        /** Comma-separated origins allowed to call the API from a browser. When unset, any local port, except in production, which must name them. */
        CORS_ORIGINS: z
            .string()
            .optional()
            .transform((value) =>
                (value ?? '')
                    .split(',')
                    .map((origin) => origin.trim())
                    .filter((origin) => origin !== ''),
            ),
        /** The SQLite file. Its folder is created when missing; `:memory:` keeps it in memory (tests). */
        DATABASE_PATH: z.string().min(1).default('./data/pkg-guard.db'),
        /** What the worker sends to take jobs and hand in results. */
        WORKER_TOKEN: z.string().min(32),
        /** Packages waiting at most; beyond it the API answers 503 instead of piling up work. */
        QUEUE_MAX_WAITING: z.coerce.number().int().min(1).max(100_000).default(200),
        /** A job whose worker said nothing for this long is taken away from it. Must outlast the worker's own job timeout. */
        JOB_LEASE_SECONDS: z.coerce.number().int().min(10).max(3600).default(180),
        /** How many times a package is tried when its worker disappears. A failure the worker reports is not retried at once. */
        JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(2),
        /** A failed package is measured again after this long: the failure may have been a registry hiccup. */
        JOB_FAILED_RETRY_MINUTES: z.coerce.number().int().min(1).max(100_000).default(60),
    })
    .superRefine((env, context) => {
        if (env.NODE_ENV !== 'production') return;
        if (env.WORKER_TOKEN === EXAMPLE_WORKER_TOKEN) context.addIssue({ code: 'custom', path: ['WORKER_TOKEN'], message: 'is the public example value: set a random one' });
        if (env.CORS_ORIGINS.length === 0) context.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'must name the allowed origins in production' });
    });

export type Config = z.infer<typeof envSchema>;

export type LoadedConfig = { ok: true; config: Config } | { ok: false; problems: string[] };

export const loadConfig = (env: Record<string, string | undefined> = process.env): LoadedConfig => {
    const parsed = envSchema.safeParse(env);
    if (parsed.success) return { ok: true, config: parsed.data };
    return { ok: false, problems: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
};
