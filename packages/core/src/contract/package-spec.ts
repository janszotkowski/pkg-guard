/** A package as someone asked for it: an exact version, a dist-tag, or neither (the latest). */
export type PackageSpec = { name: string; version: string | undefined };

const MAX_NAME_LENGTH = 214;
// Capitals only exist in old packages (`JSONStream`), but those are still installed every day.
const PACKAGE_NAME = /^(?:@[a-zA-Z0-9-~][a-zA-Z0-9-._~]*\/)?[a-zA-Z0-9-~][a-zA-Z0-9-._~]*$/;
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const DIST_TAG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** A name goes into registry URLs and file paths, so this is the only shape let through: no `..`, no second slash, no encoding. */
export const isValidPackageName = (name: string): boolean => name.length <= MAX_NAME_LENGTH && PACKAGE_NAME.test(name) && !name.split('/').some((part) => part.startsWith('.'));

export const isExactVersion = (version: string): boolean => EXACT_VERSION.test(version);

/** `react`, `react@19.1.0`, `react@next`, `@scope/name@1.2.3`. A range (`^1.0.0`) is refused: it has no single answer. */
export const parseSpec = (input: string): PackageSpec | undefined => {
    const text = input.trim();
    const at = text.lastIndexOf('@');
    const name = at > 0 ? text.slice(0, at) : text;
    const version = at > 0 ? text.slice(at + 1) : undefined;
    if (!isValidPackageName(name)) return undefined;
    if (version !== undefined && !isExactVersion(version) && !DIST_TAG.test(version)) return undefined;
    return { name, version };
};
