import { describe, expect, it } from 'vitest';
import { renderDefaultOgImage } from '@lib/ogImage';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe('the site card', () => {
    it('draws as a 1200 × 630 PNG', async () => {
        const png = await renderDefaultOgImage();
        expect([...png.subarray(0, 4)]).toEqual(PNG_SIGNATURE);
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
    }, 30_000);
});
