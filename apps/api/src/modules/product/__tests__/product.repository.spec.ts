import { describe, expect, it } from "vitest";

import { ProductRepository } from "../product.repository";

describe("ProductRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(ProductRepository.prototype.list).toBeDefined();
		expect(ProductRepository.prototype.findById).toBeDefined();
	});

	it("exposes create and delete repository methods", () => {
		expect(ProductRepository.prototype.create).toBeDefined();
		expect(ProductRepository.prototype.delete).toBeDefined();
	});
});
