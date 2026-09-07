import { describe, expect, it } from "vitest";

import { GeneratedProductRepository } from "../product.repository.generated";

describe("GeneratedProductRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(GeneratedProductRepository.prototype.list).toBeDefined();
		expect(GeneratedProductRepository.prototype.findById).toBeDefined();
	});

	it("exposes create and delete repository methods", () => {
		expect(GeneratedProductRepository.prototype.create).toBeDefined();
		expect(GeneratedProductRepository.prototype.delete).toBeDefined();
	});
});
