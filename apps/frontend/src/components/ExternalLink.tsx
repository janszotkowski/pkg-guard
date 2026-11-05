import { ExternalLink as ExternalIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** The schemes of a web page. */
const WEB_SCHEMES: readonly string[] = ['https:', 'http:'];

/**
 * The address as a link target when it is a web page (`http:` or `https:`, or one of the schemes given), else
 * undefined. The contract already refuses any other scheme for a record's links; this is the second lock, for whatever
 * reaches a page anyway, so a `javascript:` or `data:` address from a CNA's record is never something to click.
 */
export const safeHref = (url: string, schemes: readonly string[] = WEB_SCHEMES): string | undefined => {
    try {
        return schemes.includes(new URL(url).protocol) ? url : undefined;
    } catch {
        return undefined;
    }
};

type ExternalLinkProps = { href: string; children: ReactNode; className?: string };

/** A link out of the site: to a source the visitor can check, never passing on where they came from. An address that is not a web page is shown as text. */
export const ExternalLink = (props: ExternalLinkProps) => {
    const href = safeHref(props.href);
    if (href === undefined) return <span className={props.className ?? 'break-all'}>{props.children}</span>;
    return (
        <a
            href={href}
            rel={'noopener noreferrer nofollow'}
            target={'_blank'}
            className={props.className ?? 'inline-flex items-center gap-1 break-all text-link underline-offset-2 hover:underline'}
        >
            {props.children}
            <ExternalIcon
                aria-hidden={'true'}
                className={'size-3.5 shrink-0'}
            />
            {/* The icon says it to the eye; this says it to a screen reader. */}
            <span className={'sr-only'}> (opens in a new tab)</span>
        </a>
    );
};
