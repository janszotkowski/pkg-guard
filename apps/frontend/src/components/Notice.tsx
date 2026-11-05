import type { ReactNode } from 'react';
import { cn } from '@lib/utils';

type NoticeTone = 'info' | 'warning' | 'danger';

type NoticeProps = {
    /** What kind of aside this is: `info` adds context, `warning` asks for care, `danger` says something is wrong. */
    tone?: NoticeTone;
    className?: string;
    children: ReactNode;
};

/** The rule and the ink of each tone. Context is quieter than the page; a warning or a danger is read in full. */
const TONE: Record<NoticeTone, string> = {
    info: 'border-ring text-muted-foreground',
    warning: 'border-warning',
    danger: 'border-destructive',
};

/** An aside beside a result, ruled on the left in the colour of its tone: a note to assistive technology. */
export const Notice = (props: NoticeProps) => (
    <p
        role={'note'}
        className={cn('max-w-3xl border-l-2 pl-4 text-callout break-words', TONE[props.tone ?? 'info'], props.className)}
    >
        {props.children}
    </p>
);
