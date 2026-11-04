import { describe, expect, it } from 'vitest';
import { rangeChunks } from '@modules/analyses/application/download-ranges.ts';

const END = new Date('2026-11-04T20:00:00Z');

describe('rangeChunks', () => {
    it('asks once for a range npm answers whole', () => {
        expect(rangeChunks(END, 3)).toEqual([{ start: '2026-11-02', end: '2026-11-04' }]);
    });

    it('splits a long range, oldest first, without a gap or an overlap', () => {
        const chunks = rangeChunks(END, 1095);
        expect(chunks).toHaveLength(3);
        expect(chunks.at(-1)?.end).toBe('2026-11-04');
        for (const [index, chunk] of chunks.entries()) {
            const next = chunks[index + 1];
            if (next === undefined) continue;
            expect(Date.parse(next.start) - Date.parse(chunk.end)).toBe(86_400_000);
        }
        const covered = chunks.reduce((sum, chunk) => sum + (Date.parse(chunk.end) - Date.parse(chunk.start)) / 86_400_000 + 1, 0);
        expect(covered).toBe(1095);
    });
});
