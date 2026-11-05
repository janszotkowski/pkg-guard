import { describe, expect, it } from 'vitest';
import { isValidPackageName, parseSpec } from '@src/contract/package-spec.ts';

describe('parseSpec', () => {
    it.each([
        ['react', { name: 'react', version: undefined }],
        ['react@19.1.0', { name: 'react', version: '19.1.0' }],
        ['react@next', { name: 'react', version: 'next' }],
        ['@scope/name', { name: '@scope/name', version: undefined }],
        ['@scope/name@1.2.3-beta.1', { name: '@scope/name', version: '1.2.3-beta.1' }],
        ['  react  ', { name: 'react', version: undefined }],
    ])('reads %s', (input, expected) => {
        expect(parseSpec(input)).toEqual(expected);
    });

    it.each(['', 'react@^1.0.0', 'react@>=1', '../etc/passwd', '@scope/../x', 'a/b', '@scope/.hidden', 'https://example.com/x.tgz', 'a b', '.hidden'])('refuses %s', (input) => {
        expect(parseSpec(input)).toBeUndefined();
    });
});

describe('isValidPackageName', () => {
    it('refuses a name longer than the registry allows', () => {
        expect(isValidPackageName('a'.repeat(215))).toBe(false);
    });
});
