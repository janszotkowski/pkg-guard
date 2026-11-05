import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CopyButton } from '@components/CopyButton';
import { Notice } from '@components/Notice';
import { SegmentedControl, segmentStep } from '@components/SegmentedControl';
import { Button } from '@components/ui/button';

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

describe('notice', () => {
    it('is a note to assistive technology, ruled in the colour of its tone', () => {
        expect(renderToStaticMarkup(<Notice>Made for Node.js.</Notice>)).toMatch(/<p role="note" class="[^"]*border-ring[^"]*">Made for Node.js.<\/p>/);
        expect(renderToStaticMarkup(<Notice tone={'danger'}>Deprecated.</Notice>)).toContain('border-destructive');
        expect(renderToStaticMarkup(<Notice tone={'warning'}>Careful.</Notice>)).toContain('border-warning');
    });
});

describe('copy button', () => {
    it('announces what happened in a live region inside the button, and hides its icon', () => {
        const html = renderToStaticMarkup(
            <CopyButton
                label={'Copy link'}
                getText={() => 'https://example.test/'}
            />,
        );
        expect(html).toContain('<span aria-live="polite">Copy link</span>');
        expect(html).toContain('aria-hidden="true"');
    });
});

describe('icon button', () => {
    it('reaches 44 px for the pointer however small it is drawn', () => {
        const html = renderToStaticMarkup(
            <Button
                variant={'ghost'}
                size={'icon-sm'}
                aria-label={'Remove react'}
            />,
        );
        expect(html).toContain('aria-label="Remove react"');
        expect(html).toContain('after:size-[max(100%,44px)]');
    });
});
