import { Star } from 'lucide-react';
import { siteConfig } from '@config/site';
import { cn } from '@lib/utils';

type StarOnGitHubProps = { className?: string };

/** The invitation to support the project: a star on its repository. The link is taller than its frame, for a comfortable touch target. */
export const StarOnGitHub = (props: StarOnGitHubProps) => (
    <a
        href={siteConfig.repository}
        className={cn('group min-h-11 items-center text-callout whitespace-nowrap outline-none', props.className ?? 'inline-flex')}
    >
        <span
            className={
                'inline-flex h-8 items-center gap-1.5 border px-2.5 text-muted-foreground group-hover:border-link group-hover:text-foreground group-focus-visible:ring-2 group-focus-visible:ring-ring'
            }
        >
            <Star
                aria-hidden={'true'}
                className={'size-3.5 text-link group-hover:fill-link'}
            />
            Star on GitHub
        </span>
    </a>
);
