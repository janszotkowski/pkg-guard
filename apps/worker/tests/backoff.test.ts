import { describe, expect, it } from 'vitest';
import { retryDelay, worthLogging } from '@modules/backend/backoff.ts';

describe('retryDelay', () => {
    it('keeps the usual pace while nothing fails', () => {
        expect(retryDelay(0, 1000)).toBe(1000);
    });

    it('doubles with each failure, up to half a minute', () => {
        expect([1, 2, 3, 4, 5, 6, 7, 40].map((failures) => retryDelay(failures, 1000))).toEqual([1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000]);
    });

    it('never asks faster than the configured pace', () => {
        expect(retryDelay(1, 60_000)).toBe(60_000);
    });
});

describe('worthLogging', () => {
    it('says it once when the backend goes, and now and then after that', () => {
        const logged = Array.from({ length: 45 }, (_, index) => index + 1).filter(worthLogging);
        expect(logged).toEqual([1, 20, 40]);
    });
});
