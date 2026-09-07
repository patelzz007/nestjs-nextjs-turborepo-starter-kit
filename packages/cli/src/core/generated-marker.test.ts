import { describe, expect, it } from "vitest";

import {
	findGeneratedBlock,
	hasGeneratedBlock,
	removeGeneratedBlock,
	upsertGeneratedBlock,
} from "./generated-marker";
import { parseGeneratorSlug } from "../schema/generator-slug";

describe("generated-marker", () => {
	const productBlock = `// @app-generated:begin product
\tproduct: { list: "/product" },
// @app-generated:end product`;

	const productVariantBlock = `// @app-generated:begin productVariant
\tproductVariant: { list: "/product-variant" },
// @app-generated:end productVariant`;

	it("does not match product marker inside productVariant key", () => {
		const content = `${productBlock}\n${productVariantBlock}`;
		expect(hasGeneratedBlock(content, "product")).toBe(true);
		expect(hasGeneratedBlock(content, "productVariant")).toBe(true);
		const productRange = findGeneratedBlock(content, "product");
		expect(productRange?.content).toContain('list: "/product"');
		expect(productRange?.content).not.toContain("product-variant");
	});

	it("throws when end marker is missing", () => {
		const malformed = `// @app-generated:begin product\n\tdata: true\n`;
		expect(() => findGeneratedBlock(malformed, "product")).toThrow(/missing end marker/);
	});

	it("removes only the targeted block when siblings coexist", () => {
		const content = `${productBlock}\n${productVariantBlock}`;
		const next = removeGeneratedBlock(content, "product");
		expect(hasGeneratedBlock(next, "product")).toBe(false);
		expect(hasGeneratedBlock(next, "productVariant")).toBe(true);
	});

	it("matches tab-indented markers for upsert", () => {
		const content = `\t// @app-generated:begin product\n\tproduct: { list: "/product" },\n\t// @app-generated:end product\n`;
		const next = upsertGeneratedBlock(content, "product", '\tproduct: { list: "/product-v2" },', 0, { linePrefix: "\t" });
		expect(next).toContain('list: "/product-v2"');
		expect(next.match(/product:/g)?.length).toBe(1);
	});

	it("replaces duplicate generated blocks with a single upsert", () => {
		const duplicate = `${productBlock}\n${productBlock}`;
		const next = upsertGeneratedBlock(duplicate, "product", '\tproduct: { list: "/product-v2" },', 0);
		expect(hasGeneratedBlock(next, "product")).toBe(true);
		expect(next.match(/@app-generated:begin product/g)?.length).toBe(1);
		expect(next).toContain('list: "/product-v2"');
	});
});

describe("generator-slug", () => {
	it("rejects path traversal slugs", () => {
		expect(() => parseGeneratorSlug("../etc")).toThrow();
		expect(() => parseGeneratorSlug("foo/bar")).toThrow();
	});

	it("accepts valid slugs", () => {
		expect(parseGeneratorSlug("product-variant")).toBe("product-variant");
	});
});
