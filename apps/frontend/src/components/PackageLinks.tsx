import type { PackageRef } from '@pkg-guard/core';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';

type OutLinkProps = { href: string; label: string };

const OutLink = (props: OutLinkProps) => (
    <a
        href={props.href}
        target={'_blank'}
        rel={'noreferrer'}
        className={'inline-flex min-h-8 items-center gap-1 text-callout text-link underline-offset-2 hover:underline'}
    >
        {props.label}
        <ArrowUpRight
            aria-hidden={'true'}
            className={'size-3.5'}
        />
        <span className={'sr-only'}>(opens in a new tab)</span>
    </a>
);

/** A scoped name has a slash that is part of the path: each segment is encoded on its own. */
export const npmUrl = (ref: PackageRef): string => `https://www.npmjs.com/package/${ref.name.split('/').map(encodeURIComponent).join('/')}/v/${encodeURIComponent(ref.version)}`;

type PackageLinksProps = {
    package: PackageRef;
    /** Known once the package has been read, and only when it names one. */
    repositoryUrl?: string | null | undefined;
};

/** Where the package lives. npm always has it; GitHub only when the package says so. */
export const PackageLinks = (props: PackageLinksProps) => (
    <div className={'flex items-center gap-4'}>
        <Link
            to={'/trends'}
            search={{ packages: props.package.name }}
            className={'inline-flex min-h-8 items-center text-callout text-link underline-offset-2 hover:underline'}
        >
            Compare trends
        </Link>
        <OutLink
            href={npmUrl(props.package)}
            label={'npm'}
        />
        {typeof props.repositoryUrl === 'string' && (
            <OutLink
                href={props.repositoryUrl}
                label={'GitHub'}
            />
        )}
    </div>
);
