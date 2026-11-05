import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { fetchAnalysis, fetchDownloads, fetchHistory, fetchMetadata, fetchSuggestions } from '@lib/api';
import { registerWebMcpTools, webMcpTools } from '@lib/webmcp';

/** Offers the site's WebMCP tools to an AI agent in the browser, while the app is mounted. Renders nothing. */
export const WebMcpTools = () => {
    const router = useRouter();

    useEffect(
        () =>
            registerWebMcpTools(
                webMcpTools({
                    api: { analysis: fetchAnalysis, search: fetchSuggestions, history: fetchHistory, downloads: fetchDownloads, metadata: fetchMetadata },
                    showPackage: (spec) => router.navigate({ to: '/package/$', params: { _splat: spec } }),
                    showTrends: (search) => router.navigate({ to: '/trends', search }),
                }),
            ),
        [router],
    );

    return null;
};
