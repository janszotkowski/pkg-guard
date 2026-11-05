import { Markdown, type MarkdownComponents } from '@tanstack/markdown/react';
import { useEffect, useState } from 'react';
import { CodeBlock } from '@components/CodeBlock';
import { DocOutline } from '@components/DocOutline';
import { docOptions, type Doc, type OutlineEntry } from '@lib/docs';

type DocPageProps = { doc: Doc };

const components = {
    pre: CodeBlock,
    // Wide tables scroll inside their own box instead of widening the page on a phone.
    table: (props) => (
        <div
            className={'markdown-table'}
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must take focus (WCAG 2.1.1); the table inside names itself
            tabIndex={0}
        >
            <table {...props} />
        </div>
    ),
    a: (props) => (
        <a
            {...props}
            {...(props.href?.startsWith('http') === true ? { rel: 'noopener noreferrer' } : {})}
        >
            {props.children}
        </a>
    ),
} satisfies MarkdownComponents;

/** How far below the top of the window a heading counts as reached: past the sticky header (`scroll-padding-top`). */
const REACHED_PX = 96;

/** The last heading scrolled past the header, or the first one while none is. */
const currentId = (entries: readonly OutlineEntry[]): string | undefined => {
    // At the bottom of the page a short last section can never reach the top: it is the one being read.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) return entries.at(-1)?.id;
    let current = entries[0]?.id;
    for (const entry of entries) {
        const heading = document.getElementById(entry.id);
        if (heading === null || heading.getBoundingClientRect().top > REACHED_PX) break;
        current = entry.id;
    }
    return current;
};

/** The id of the heading being read, followed as the page scrolls: measured once a frame, for both outlines. Undefined on the server. */
const useActiveHeading = (entries: readonly OutlineEntry[]): string | undefined => {
    const [active, setActive] = useState<string | undefined>(undefined);

    useEffect(() => {
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setActive(currentId(entries)));
        };
        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [entries]);

    return active;
};

/** A document of `docs/` as a page: its outline beside it (folded above it on a phone) and the text. */
export const DocPage = (props: DocPageProps) => {
    const active = useActiveHeading(props.doc.outline);

    return (
        <main
            id={'main'}
            tabIndex={-1}
            className={'mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 py-10 sm:py-14 lg:grid-cols-[13rem_minmax(0,1fr)]'}
        >
            <DocOutline
                entries={props.doc.outline}
                active={active}
                className={'hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto'}
            />
            {/* Phones and narrow windows have no room for the column: the same outline, folded, above the text. */}
            <DocOutline
                entries={props.doc.outline}
                active={active}
                collapsible
                className={'-mb-6 lg:hidden'}
            />
            <article className={'markdown-doc max-w-3xl min-w-0'}>
                <Markdown
                    {...docOptions}
                    components={components}
                >
                    {props.doc.document}
                </Markdown>
            </article>
        </main>
    );
};
