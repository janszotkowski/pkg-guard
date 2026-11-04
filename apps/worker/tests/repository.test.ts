import { describe, expect, it } from 'vitest';
import { githubUrl } from '@modules/analysis/repository.ts';

describe('githubUrl', () => {
    it.each([
        'https://github.com/owner/name',
        'https://github.com/owner/name.git',
        'https://github.com/owner/name/',
        'https://www.github.com/owner/name',
        'http://github.com/owner/name',
        'git+https://github.com/owner/name.git',
        'git://github.com/owner/name.git',
        'ssh://git@github.com/owner/name.git',
        'git+ssh://git@github.com/owner/name.git',
        'git@github.com:owner/name.git',
        'github:owner/name',
        'owner/name',
        'https://github.com/owner/name.git#main',
    ])('reads %s', (spelling) => {
        expect(githubUrl(spelling)).toBe('https://github.com/owner/name');
    });

    it('reads the object form', () => {
        expect(githubUrl({ type: 'git', url: 'git+https://github.com/owner/name.git' })).toBe('https://github.com/owner/name');
    });

    it('leads to the folder of a package in a monorepo', () => {
        expect(githubUrl({ url: 'https://github.com/owner/name.git', directory: 'packages/react' })).toBe('https://github.com/owner/name/tree/HEAD/packages/react');
        expect(githubUrl({ url: 'https://github.com/owner/name.git', directory: './packages/react/' })).toBe('https://github.com/owner/name/tree/HEAD/packages/react');
    });

    it('stays at the repository when the folder is not a plain path', () => {
        expect(githubUrl({ url: 'https://github.com/owner/name', directory: '../../evil' })).toBe('https://github.com/owner/name');
        expect(githubUrl({ url: 'https://github.com/owner/name', directory: 'a b' })).toBe('https://github.com/owner/name');
    });

    it.each([
        'https://gitlab.com/owner/name',
        'https://github.com.evil.example/owner/name',
        'https://evil.example/github.com/owner/name',
        'javascript:alert(1)',
        'https://github.com/owner',
        'https://github.com/owner/name/extra',
        '../name',
        '',
        undefined,
        null,
        42,
        {},
    ])('finds no GitHub page in %j', (value) => {
        expect(githubUrl(value)).toBeNull();
    });
});
