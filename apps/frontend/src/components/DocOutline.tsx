import { useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import type { OutlineEntry } from '@lib/docs';
import { cn } from '@lib/utils';

type DocOutlineProps = {
    entries: readonly OutlineEntry[];
    /** The id of the heading being read, marked in the list; none on the server. */
    active?: string | undefined;
    className?: string;
    /** Folded under a summary line, for a phone: opens on a tap and closes again once a section is picked. */
    collapsible?: boolean;
};

/** A document's sections as anchor links, the one being read marked. */
export const DocOutline = (props: DocOutlineProps) => {
    const details = useRef<HTMLDetailsElement>(null);

    const list = (
        <ul className={'flex flex-col gap-0.5 border-l text-callout'}>
            {props.entries.map((entry) => (
                <li key={entry.id}>
                    <a
                        href={`#${entry.id}`}
                        aria-current={entry.id === props.active ? 'location' : undefined}
                        onClick={() => {
                            if (details.current !== null) details.current.open = false;
                        }}
                        className={cn(
                            '-ml-px block border-l border-transparent py-1 pr-2 text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                            entry.depth === 2 ? 'pl-3' : 'pl-6',
                            entry.code && 'font-mono text-[0.8125rem]',
                            entry.id === props.active && 'border-link text-foreground',
                        )}
                    >
                        {/* Every endpoint is a GET under /v1: the rest of the path is what tells them apart. */}
                        {entry.code ? entry.text.replace(/^GET \/v1/, '') : entry.text}
                    </a>
                </li>
            ))}
        </ul>
    );

    return (
        <nav
            aria-label={'On this page'}
            className={props.className}
        >
            {props.collapsible === true ? (
                <details
                    ref={details}
                    className={'group/outline rounded-md border bg-card'}
                >
                    <summary
                        className={
                            'flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-callout font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden'
                        }
                    >
                        On this page
                        <ChevronDown
                            aria-hidden={'true'}
                            className={'size-4 text-muted-foreground transition-transform group-open/outline:rotate-180'}
                        />
                    </summary>
                    <div className={'max-h-[60dvh] overflow-y-auto px-4 pb-4'}>{list}</div>
                </details>
            ) : (
                <>
                    <p className={'mb-3 text-caption font-semibold tracking-wide text-subtle-foreground uppercase'}>On this page</p>
                    {list}
                </>
            )}
        </nav>
    );
};
