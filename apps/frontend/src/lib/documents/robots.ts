import { canonicalUrl } from '@config/site';

/** AI crawlers by what they do: training, search for answers, and fetching a page a person asked about. All are welcome. */
const AI_AGENTS = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'Claude-User',
    'anthropic-ai',
    'PerplexityBot',
    'Perplexity-User',
    'GoogleOther',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
];

/**
 * `robots.txt`. Production lets every crawler in, AI crawlers included (the data is public and the site wants to be cited):
 * a named group replaces `*`, so it repeats every rule. Anything else (staging, previews) keeps all crawlers out, on top of
 * the `noindex` every page sends there. Nothing a page relies on for its `noindex` is disallowed.
 */
export const robotsTxt = (allowIndexing: boolean): string => {
    if (!allowIndexing) return 'User-agent: *\nDisallow: /\n';
    const rules = ['Content-Signal: ai-train=yes, search=yes, ai-input=yes', 'Allow: /', 'Allow: /llms.txt'];
    return ['User-agent: *', ...rules, '', ...AI_AGENTS.map((agent) => `User-agent: ${agent}`), ...rules, '', `Sitemap: ${canonicalUrl('/sitemap.xml')}`, ''].join('\n');
};
