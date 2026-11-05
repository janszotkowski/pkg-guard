/** However long the backend is away, the worker asks again at least this often. */
const MAX_DELAY_MS = 30_000;

/** How long to wait after this many failures in a row: the usual pace at first, twice as long each time, up to a limit. */
export const retryDelay = (failures: number, pollMs: number): number => (failures <= 0 ? pollMs : Math.max(pollMs, Math.min(pollMs * 2 ** (failures - 1), MAX_DELAY_MS)));

/** A backend that is away says so once when it goes, and now and then after that, not on every try. */
export const worthLogging = (failures: number): boolean => failures === 1 || failures % 20 === 0;
