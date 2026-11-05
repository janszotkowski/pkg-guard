import { createFileRoute } from '@tanstack/react-router';
import { DocPage } from '@components/DocPage';
import { siteConfig } from '@config/site';
import { doc } from '@lib/docs';
import { publicPage } from '@lib/documents/pages';
import { pageHead } from '@lib/head';
// The page's one source: the same file GitHub shows, so the site and the repository never disagree.
import source from '@docs/CHANGELOG.md?raw';

const PAGE = publicPage('/changelog');

const changelogDoc = doc(source);

const ChangelogPage = () => <DocPage doc={changelogDoc()} />;

export const Route = createFileRoute('/changelog')({
    head: () =>
        pageHead({
            title: PAGE.title,
            description: PAGE.description ?? siteConfig.description,
            path: PAGE.path,
            breadcrumbs: [
                { name: 'Home', path: '/' },
                { name: 'Changelog', path: PAGE.path },
            ],
        }),
    component: ChangelogPage,
});
