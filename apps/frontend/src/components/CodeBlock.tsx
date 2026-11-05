import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Check, Copy } from 'lucide-react';

/** How long the button says "Copied" before it offers to copy again. */
const COPIED_MS = 2000;

/** A code block of a rendered document with a button that copies its text, as it reads (no highlighting markup). */
export const CodeBlock = (props: ComponentProps<'pre'>) => {
    const pre = useRef<HTMLPreElement>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), COPIED_MS);
        return () => clearTimeout(timer);
    }, [copied]);

    const copy = () => {
        const text = pre.current?.textContent ?? '';
        void navigator.clipboard.writeText(text.replace(/\n$/, '')).then(
            () => setCopied(true),
            () => undefined,
        );
    };

    return (
        <div className={'code-block group/code relative'}>
            {/* Focusable, so a long line can be scrolled from the keyboard; not a landmark, as dozens of them would bury the page's own. */}
            <pre
                {...props}
                ref={pre}
                // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must take focus (WCAG 2.1.1)
                tabIndex={0}
            />
            <button
                type={'button'}
                onClick={copy}
                aria-label={'Copy code'}
                className={
                    'absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-md border bg-card text-muted-foreground opacity-70 transition-opacity outline-none group-hover/code:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50'
                }
            >
                {copied ? (
                    <Check
                        aria-hidden={'true'}
                        className={'size-4'}
                    />
                ) : (
                    <Copy
                        aria-hidden={'true'}
                        className={'size-4'}
                    />
                )}
            </button>
            <span
                role={'status'}
                className={'sr-only'}
            >
                {copied ? 'Copied to the clipboard' : ''}
            </span>
        </div>
    );
};
