import * as z from 'zod/mini';

/**
 * The answer of `GET /v1/metadata`: what npm says about one version, read from the registry and never from an install.
 * It lives outside the stored result because a version can be deprecated long after it was measured.
 */
export const packageMetadataSchema = z.object({
    name: z.string(),
    version: z.string(),
    /** The author's message, or null when the version is not deprecated. */
    deprecated: z.nullable(z.string()),
    license: z.nullable(z.string()),
    /** `none` means none declared: a package can still ship an `index.d.ts` without naming it. */
    types: z.enum(['included', 'separate', 'none']),
    /** The `@types` package, when `types` is `separate`. */
    typesPackage: z.nullable(z.string()),
    /** What runs when this package is installed. Its dependencies can have scripts of their own. */
    installScripts: z.array(z.string()),
});

export type PackageMetadata = z.infer<typeof packageMetadataSchema>;
