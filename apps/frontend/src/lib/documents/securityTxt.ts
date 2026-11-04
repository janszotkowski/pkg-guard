import { canonicalUrl, siteConfig } from '@config/site';

/**
 * `/.well-known/security.txt` (RFC 9116): where to report a vulnerability in the site itself, privately through GitHub.
 * It must expire within a year; computed from `now`, it never goes stale while the site runs.
 */
export const securityTxt = (now: Date): string => {
    const expires = new Date(now.getTime() + 180 * 86_400_000);
    return [
        `Contact: ${siteConfig.repository}/security/advisories/new`,
        `Expires: ${expires.toISOString()}`,
        'Preferred-Languages: en, cs',
        `Canonical: ${canonicalUrl('/.well-known/security.txt')}`,
        `Policy: ${siteConfig.repository}/blob/main/SECURITY.md`,
        '',
    ].join('\n');
};
