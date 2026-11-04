import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/** Every setting the worker reads from the environment, validated once at start-up. */
const envSchema = z.object({
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    BACKEND_URL: z.url().default('http://127.0.0.1:4100'),
    /** What the worker sends to the backend. It never reaches the process that handles a package. */
    WORKER_TOKEN: z.string().min(32),
    /** Where packages are installed and the shared pnpm store lives: outside the repository unless set otherwise. */
    WORKER_DIR: z.string().min(1).default(join(tmpdir(), 'pkg-guard-worker')),
    /** Packages handled at the same time. */
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
    /** How often the backend is asked for work while there is none. */
    WORKER_POLL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
    /** One whole analysis at most; past it the process is killed. Must stay under the backend's JOB_LEASE_SECONDS. */
    JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(120_000),
    /** The most a package with its dependencies may take on disk. */
    MAX_INSTALL_BYTES: z.coerce
        .number()
        .int()
        .min(1)
        .default(1024 ** 3),
});

export type Config = z.infer<typeof envSchema>;

export type LoadedConfig = { ok: true; config: Config } | { ok: false; problems: string[] };

export const loadConfig = (env: Record<string, string | undefined> = process.env): LoadedConfig => {
    const parsed = envSchema.safeParse(env);
    if (parsed.success) return { ok: true, config: parsed.data };
    return { ok: false, problems: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
};
