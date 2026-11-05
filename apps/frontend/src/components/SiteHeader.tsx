import { Link, useRouterState } from '@tanstack/react-router';
import { PackageCheck } from 'lucide-react';
import { DesktopNav } from '@components/DesktopNav';
import { MobileNav } from '@components/MobileNav';
import { PackageSearch } from '@components/PackageSearch';
import { ThemeToggle } from '@components/ThemeToggle';
import { siteConfig } from '@config/site';

export const SiteHeader = () => {
    // The home page has the big search of its own.
    const home = useRouterState({ select: (state) => state.location.pathname === '/' });
    return (
        <header className={'glass-heavy sticky top-0 z-30 border-x-0 border-t-0'}>
            <div className={'mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2'}>
                <Link
                    to={'/'}
                    className={'flex min-h-11 items-center gap-2 text-headline whitespace-nowrap'}
                >
                    <PackageCheck
                        aria-hidden={'true'}
                        className={'size-5 text-link'}
                    />
                    <span className={home ? undefined : 'hidden sm:inline'}>{siteConfig.title}</span>
                </Link>
                <div className={'flex min-w-0 flex-1 items-center justify-end gap-1'}>
                    {!home && (
                        <div className={'mr-1 w-full max-w-xs'}>
                            <PackageSearch compact />
                        </div>
                    )}
                    <DesktopNav />
                    <ThemeToggle />
                    <MobileNav />
                </div>
            </div>
        </header>
    );
};
