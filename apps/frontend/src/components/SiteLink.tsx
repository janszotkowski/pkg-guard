import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import type { NavLink } from '@config/nav';

type SiteLinkProps = Omit<ComponentProps<'a'>, 'href' | 'target'> & { link: NavLink };

/** A link of the site's navigation: through the router to a page of the site, as a plain link to anywhere else. */
export const SiteLink = (props: SiteLinkProps) => {
    const { link, children, ...rest } = props;
    return link.to === undefined ? (
        <a
            {...rest}
            href={link.href}
        >
            {children}
        </a>
    ) : (
        <Link
            {...rest}
            to={link.to}
            search={{}}
        >
            {children}
        </Link>
    );
};
