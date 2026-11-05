import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** Every setting the worker reads from the environment, validated once at start-up. */
const envSchema = z.object({
    /** Set by the image alone. This process downloads npm packages, and they must never land on the machine it would otherwise run on. */
    WORKER_IN_CONTAINER: z.literal('true', { error: 'the worker runs only in Docker, so that the packages it downloads stay there: use `pnpm dev` or `docker compose up worker`' }),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    BACKEND_URL: z.url().default('http://127.0.0.1:4100'),
    /** What the worker sends to the backend. It never reaches the process that handles a package. */
    WORKER_TOKEN: z.string().min(32),
    /** Where packages are installed and the shared pnpm store lives: the container's own volume. */
    WORKER_DIR: z.string().min(1).default('/work'),
    /** Packages handled at the same time. Each may take JOB_MEMORY_MB: the container's memory limit must hold them all, and the worker itself. */
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(1),
    /** How often the backend is asked for work while there is none. */
    WORKER_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
    /** One whole analysis at most; past it the process is killed. Must stay under the backend's JOB_LEASE_SECONDS. */
    JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(120_000),
    /** The heap the process of one analysis may grow to: the bundler holds a whole package's code in memory. */
    JOB_MEMORY_MB: z.coerce.number().int().min(256).max(16_384).default(2048),
    /** How long a package's subpaths and exports are measured, one bundle each; what is done by then is kept. Must leave the main analysis room in JOB_TIMEOUT_MS. */
    PARTS_BUDGET_MS: z.coerce.number().int().min(0).max(600_000).default(45_000),
    /** The most a package with its dependencies may take on disk. */
    MAX_INSTALL_BYTES: z.coerce
        .number()
        .int()
        .min(1)
        .default(1024 ** 3),
    /** The most the shared pnpm store, which keeps every package ever installed here, may take on disk before it is emptied. */
    STORE_MAX_BYTES: z.coerce
        .number()
        .int()
        .min(1024 ** 2)
        .default(10 * 1024 ** 3),
});

export type Config = z.infer<typeof envSchema>;

export type LoadedConfig = { ok: true; config: Config } | { ok: false; problems: string[] };

export const loadConfig = (env: Record<string, string | undefined> = process.env): LoadedConfig => {
    const parsed = envSchema.safeParse(env);
    if (parsed.success) return { ok: true, config: parsed.data };
    return { ok: false, problems: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
};
