export type RateLimitResult = { allowed: boolean; limit: number; remaining: number; resetSeconds: number };

/** Distinct callers counted apart in one window; past it, newcomers share one count, so a flood of addresses cannot grow the map. */
const MAX_KEYS = 10_000;

/**
 * A fixed-window request counter per caller: `limit` requests per `windowMs`. In memory, which is right for the one API
 * process this service runs; windows that ended are swept so the map does not grow with every address seen, and it holds
 * at most `maxKeys` callers at once.
 */
export const createRateLimiter = (options: { limit: number; windowMs: number; maxKeys?: number; now?: () => number }) => {
    const now = options.now ?? Date.now;
    const maxKeys = options.maxKeys ?? MAX_KEYS;
    const windows = new Map<string, { start: number; count: number }>();
    let lastSweep = now();

    const sweep = (time: number): void => {
        if (time - lastSweep < options.windowMs) return;
        lastSweep = time;
        for (const [key, window] of windows) if (time - window.start >= options.windowMs) windows.delete(key);
    };

    return {
        hit: (caller: string): RateLimitResult => {
            const time = now();
            sweep(time);
            // One more caller than the map holds: counted with every other newcomer, never left out.
            const key = windows.has(caller) || windows.size < maxKeys ? caller : '*';
            let window = windows.get(key);
            if (window === undefined || time - window.start >= options.windowMs) {
                window = { start: time, count: 0 };
                windows.set(key, window);
            }
            window.count++;
            return {
                allowed: window.count <= options.limit,
                limit: options.limit,
                remaining: Math.max(0, options.limit - window.count),
                resetSeconds: Math.max(1, Math.ceil((window.start + options.windowMs - time) / 1000)),
            };
        },
    };
};

export type RateLimiter = ReturnType<typeof createRateLimiter>;
