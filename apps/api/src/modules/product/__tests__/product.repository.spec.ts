import { describe, expect, it } from "vitest";

import { GeneratedProductRepository } from "../product.repository.generated";

describe("GeneratedProductRepository", () => {
	it("is defined", () => {
		expect(GeneratedProductRepository).toBeDefined();
	});
});
