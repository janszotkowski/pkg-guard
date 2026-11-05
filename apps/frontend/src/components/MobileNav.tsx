import { Dialog } from '@base-ui/react/dialog';
import { useLocation } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { SiteLink } from '@components/SiteLink';
import { StarOnGitHub } from '@components/StarOnGitHub';
import { isCurrentLink, NAV_GROUPS } from '@config/nav';
import { cn } from '@lib/utils';

const ICON_BUTTON = 'inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

/** The menu on narrow screens: every link of the site on one full-screen panel, closed again by following a link. */
export const MobileNav = () => {
    const [open, setOpen] = useState(false);
    const pathname = useLocation({ select: (location) => location.pathname });

    return (
        <Dialog.Root
            open={open}
            onOpenChange={setOpen}
        >
            <Dialog.Trigger
                aria-label={'Open menu'}
                className={cn(ICON_BUTTON, 'md:hidden')}
            >
                <Menu
                    aria-hidden={'true'}
                    className={'size-5'}
                />
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Popup
                    className={
                        'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground outline-none motion-safe:transition-opacity motion-safe:duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0'
                    }
                >
                    <div className={'sticky top-0 flex items-center justify-between border-b bg-background px-4 py-2'}>
                        <Dialog.Title className={'text-headline'}>Menu</Dialog.Title>
                        <Dialog.Close
                            aria-label={'Close menu'}
                            className={ICON_BUTTON}
                        >
                            <X
                                aria-hidden={'true'}
                                className={'size-5'}
                            />
                        </Dialog.Close>
                    </div>
                    <nav
                        aria-label={'Main'}
                        className={'flex flex-col gap-8 px-4 py-6'}
                    >
                        {NAV_GROUPS.map((group) => (
                            <section
                                key={group.title}
                                className={'flex flex-col gap-2'}
                            >
                                <h2 className={'text-overline text-subtle-foreground uppercase'}>{group.title}</h2>
                                <ul className={'flex flex-col divide-y border-y'}>
                                    {group.links.map((link) => {
                                        const current = isCurrentLink(link, pathname);
                                        return (
                                            <li key={link.label}>
                                                <SiteLink
                                                    link={link}
                                                    aria-current={current ? 'page' : undefined}
                                                    onClick={() => setOpen(false)}
                                                    className={cn('flex min-h-12 items-center text-muted-foreground hover:text-foreground', current && 'font-semibold text-foreground')}
                                                >
                                                    {link.label}
                                                </SiteLink>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}
                        <StarOnGitHub className={'inline-flex w-fit'} />
                    </nav>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
