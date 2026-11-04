/** npm answers at most 18 months per request and quietly cuts the rest off, so a longer range takes several. */
const MAX_DAYS_PER_REQUEST = 540;
const DAY_MS = 86_400_000;

const dayOf = (time: number): string => new Date(time).toISOString().slice(0, 10);

/** The requests that cover `days` days up to `end`, oldest first, with no gap and no overlap. */
export const rangeChunks = (end: Date, days: number): { start: string; end: string }[] => {
    const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const chunks: { start: string; end: string }[] = [];
    for (let remaining = days; remaining > 0; remaining -= MAX_DAYS_PER_REQUEST) {
        const chunkEnd = last - (days - remaining) * DAY_MS;
        const chunkDays = Math.min(remaining, MAX_DAYS_PER_REQUEST);
        chunks.unshift({ start: dayOf(chunkEnd - (chunkDays - 1) * DAY_MS), end: dayOf(chunkEnd) });
    }
    return chunks;
};
