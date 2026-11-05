import { describe, expect, it } from 'vitest';
import { formatCount, formatDownloadTimes, formatSize, formatSizeText } from '@lib/format';

describe('formatCount', () => {
    it('shortens large counts', () => {
        expect(formatCount(950)).toBe('950');
        expect(formatCount(89_744_743)).toBe('89.7M');
    });
});

describe('formatSize', () => {
    it.each([
        [0, { value: '0', unit: 'B' }],
        [999, { value: '999', unit: 'B' }],
        [1000, { value: '1.0', unit: 'kB' }],
        [14_425, { value: '14.4', unit: 'kB' }],
        [1_515_380, { value: '1.52', unit: 'MB' }],
    ])('formats %d', (bytes, expected) => {
        expect(formatSize(bytes)).toEqual(expected);
    });

    it('joins the value and the unit', () => {
        expect(formatSizeText(1000)).toBe('1.0 kB');
    });
});

describe('formatDownloadTimes', () => {
    it.each([
        [10, '< 1 ms on slow 3G (400 kbit/s), < 1 ms on 4G (9 Mbit/s)'],
        [10_000, '200 ms on slow 3G (400 kbit/s), 9 ms on 4G (9 Mbit/s)'],
        [50_000, '1.0 s on slow 3G (400 kbit/s), 44 ms on 4G (9 Mbit/s)'],
        [5_000_000, '1 min 40 s on slow 3G (400 kbit/s), 4.4 s on 4G (9 Mbit/s)'],
    ])('formats %d bytes', (bytes, expected) => {
        expect(formatDownloadTimes(bytes)).toBe(expected);
    });
});
