import { useLocation } from '@tanstack/react-router';
import { SiteLink } from '@components/SiteLink';
import { HEADER_LINKS, isCurrentLink } from '@config/nav';
import { cn } from '@lib/utils';

/** The header's links, from tablet width up: the few pages of the site, the current one marked. */
export const DesktopNav = () => {
    const pathname = useLocation({ select: (location) => location.pathname });

    return (
        <nav
            aria-label={'Main'}
            className={'hidden md:block'}
        >
            <ul className={'flex items-center gap-1 text-callout'}>
                {HEADER_LINKS.map((link) => {
                    const current = isCurrentLink(link, pathname);
                    return (
                        <li key={link.label}>
                            <SiteLink
                                link={link}
                                aria-current={current ? 'page' : undefined}
                                className={cn(
                                    'inline-flex min-h-11 items-center px-2.5 whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                                    current && 'text-foreground',
                                )}
                            >
                                {link.label}
                            </SiteLink>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};
