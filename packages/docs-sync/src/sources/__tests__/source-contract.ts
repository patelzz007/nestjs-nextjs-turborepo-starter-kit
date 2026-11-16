import { SourceBodySchema, SourceDocumentMetaSchema } from "@workspace/docs-content/document";
import { describe, expect, it } from "vitest";

import type { DocsSource } from "../../source.ts";

/**
 * What every source must do, whatever tool it reads (ADR 084). A new source's test file calls this with a source
 * set up to hold at least one published document, and with a way to make the tool unreachable.
 */
export function describeDocsSource(name: string, setup: { readonly healthy: () => DocsSource; readonly unreachable: () => DocsSource }): void {
	describe(`${name} honours the DocsSource contract`, () => {
		it("lists documents in the neutral shape, each with a lasting identity", async () => {
			const documents = await setup.healthy().list();

			expect(documents.length).toBeGreaterThan(0);
			for (const document of documents) {
				expect(SourceDocumentMetaSchema.safeParse(document).success).toBe(true);
			}
			expect(new Set(documents.map((document) => document.sourceId)).size).toBe(documents.length);
		});

		it("gives the same details for the same document, so an unchanged sync stays unchanged", async () => {
			const source = setup.healthy();

			expect(await source.list()).toEqual(await source.list());
		});

		it("reads a document's body in the neutral shape", async () => {
			const source = setup.healthy();
			const [document] = await source.list();
			if (document === undefined) {
				throw new Error("The contract needs one published document");
			}

			expect(SourceBodySchema.safeParse(await source.read(document)).success).toBe(true);
		});

		it("throws rather than answer with a partial list, which would unpublish pages", async () => {
			await expect(setup.unreachable().list()).rejects.toBeInstanceOf(Error);
		});
	});
}
