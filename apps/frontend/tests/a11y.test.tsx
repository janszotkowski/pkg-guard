import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SegmentedControl, segmentStep } from '@components/SegmentedControl';

describe('segmented control', () => {
    it('moves by the ARIA radio group keys, wrapping at the ends', () => {
        expect(segmentStep('ArrowRight', 0, 3)).toBe(1);
        expect(segmentStep('ArrowDown', 2, 3)).toBe(0);
        expect(segmentStep('ArrowLeft', 0, 3)).toBe(2);
        expect(segmentStep('ArrowUp', 1, 3)).toBe(0);
        expect(segmentStep('Home', 2, 3)).toBe(0);
        expect(segmentStep('End', 0, 3)).toBe(2);
        expect(segmentStep('a', 0, 3)).toBeUndefined();
    });

    it('is one Tab stop: only the chosen option is focusable, and the group is named', () => {
        const html = renderToStaticMarkup(
            <SegmentedControl
                label={'View'}
                value={'b'}
                options={[
                    { value: 'a', label: 'A' },
                    { value: 'b', label: 'B' },
                ]}
                onChange={() => undefined}
            />,
        );
        expect(html).toContain('role="radiogroup" aria-label="View"');
        expect(html.match(/tabindex="0"/g)).toHaveLength(1);
        expect(html).toMatch(/aria-checked="true" tabindex="0"[^>]*>B</);
    });
});
