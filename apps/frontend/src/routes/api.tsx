import { createFileRoute } from '@tanstack/react-router';
import { DocPage } from '@components/DocPage';
import { siteConfig } from '@config/site';
import { doc } from '@lib/docs';
import { publicPage } from '@lib/documents/pages';
import { pageHead } from '@lib/head';
// The page's one source: the same file GitHub shows, so the site and the repository never disagree.
import source from '@docs/API.md?raw';

const PAGE = publicPage('/api');

const apiDoc = doc(source);

const ApiPage = () => <DocPage doc={apiDoc()} />;

export const Route = createFileRoute('/api')({
    head: () =>
        pageHead({
            title: PAGE.title,
            description: PAGE.description ?? siteConfig.description,
            path: PAGE.path,
            breadcrumbs: [
                { name: 'Home', path: '/' },
                { name: 'API', path: PAGE.path },
            ],
        }),
    component: ApiPage,
});
