import { describe, expect, it } from 'vitest';
import { API_VERSION, openApiDocument } from '@src/contract/openapi.ts';

describe('openApiDocument', () => {
    const document = openApiDocument();

    it('points every reference at a schema it defines', () => {
        const refs = [...JSON.stringify(document).matchAll(/"\$ref":"#\/components\/schemas\/(\w+)"/g)].map((match) => match[1]);
        expect(refs.length).toBeGreaterThan(0);
        for (const name of refs) expect(document.components.schemas).toHaveProperty(name as string);
    });

    it('leaves objects open, so a field added to /v1 never breaks a generated client', () => {
        expect(JSON.stringify(document)).not.toContain('"additionalProperties":false');
        expect(JSON.stringify(document)).not.toContain('$schema');
    });

    it('names every operation once, with the contract version', () => {
        const ids = Object.values(document.paths).flatMap((path) => Object.values(path).map((operation) => operation.operationId));
        expect(new Set(ids).size).toBe(ids.length);
        expect(document.info.version).toBe(API_VERSION);
    });

    it('says the rate limit it is configured with', () => {
        expect(openApiDocument({ rateLimitPerMinute: 7 }).info.description).toContain('7 requests per minute');
    });
});
