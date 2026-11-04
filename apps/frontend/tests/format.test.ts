import { describe, expect, it } from 'vitest';
import { formatSize, formatSizeText } from '@lib/format';

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
