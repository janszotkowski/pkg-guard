import { createFileRoute } from '@tanstack/react-router';
import { DocPage } from '@components/DocPage';
import { siteConfig } from '@config/site';
import { doc } from '@lib/docs';
import { publicPage } from '@lib/documents/pages';
import { pageHead } from '@lib/head';
// The page's one source: the same file GitHub shows, so the site and the repository never disagree.
import source from '@docs/MCP.md?raw';

const PAGE = publicPage('/mcp');

const mcpDoc = doc(source);

const McpPage = () => <DocPage doc={mcpDoc()} />;

export const Route = createFileRoute('/mcp')({
    head: () =>
        pageHead({
            title: PAGE.title,
            description: PAGE.description ?? siteConfig.description,
            path: PAGE.path,
            breadcrumbs: [
                { name: 'Home', path: '/' },
                { name: 'MCP server', path: PAGE.path },
            ],
        }),
    component: McpPage,
});
