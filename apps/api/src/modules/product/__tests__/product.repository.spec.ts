import { describe, expect, it } from "vitest";

import { ProductRepository } from "../product.repository";

describe("ProductRepository", () => {
	it("exposes list and findById repository methods", () => {
		expect(ProductRepository.prototype).toHaveProperty("list", expect.any(Function));
		expect(ProductRepository.prototype).toHaveProperty("findById", expect.any(Function));
	});

	it("exposes create and delete repository methods", () => {
		expect(ProductRepository.prototype).toHaveProperty("create", expect.any(Function));
		expect(ProductRepository.prototype).toHaveProperty("delete", expect.any(Function));
	});
});
