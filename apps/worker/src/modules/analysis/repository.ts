const GITHUB = /^(?:github:|(?:git\+)?(?:https?|ssh|git):\/\/(?:[^@/]+@)?(?:www\.)?github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:#.*)?$/;
const DIRECTORY = /^[\w@.-]+(?:\/[\w@.-]+)*$/;

/**
 * The package's GitHub page, from the `repository` field of its `package.json`. The field is whatever the author wrote,
 * in any of npm's spellings, and ends up as a link: only an address rebuilt from a plain owner and name leaves here.
 * A package in a monorepo may name its folder, and then the link leads there.
 */
export const githubUrl = (repository: unknown): string | null => {
    const fields = typeof repository === 'object' && repository !== null ? (repository as { url?: unknown; directory?: unknown }) : { url: repository };
    if (typeof fields.url !== 'string') return null;
    const match = GITHUB.exec(fields.url.trim());
    const [owner, name] = [match?.[1], match?.[2]];
    if (owner === undefined || name === undefined || owner.startsWith('.') || name.startsWith('.')) return null;
    const root = `https://github.com/${owner}/${name}`;
    const directory = typeof fields.directory === 'string' ? fields.directory.replace(/^\.?\//, '').replace(/\/$/, '') : '';
    const safe = DIRECTORY.test(directory) && !directory.split('/').some((part) => part.startsWith('.'));
    return safe ? `${root}/tree/HEAD/${directory}` : root;
};
