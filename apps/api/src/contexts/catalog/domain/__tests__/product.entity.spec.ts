import type { Product } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ProductEntity } from "../entities/product.entity";

const PRODUCT: Product = {
	id: "0b6f8f5e-6d3b-4a59-9d55-4c3b1f2a7e10",
	brand: "Acme",
	categoryId: "5f2d1c4b-8a7e-4b6f-9c3d-2e1f0a9b8c7d",
	compareAtPrice: null,
	description: null,
	imageUrl: null,
	isActive: true,
	isFeatured: false,
	name: "Mug",
	price: 10,
	shortDescription: null,
	sku: "mug-1",
	slug: "mug",
	stockQuantity: 3,
	weightGrams: null,
	version: 4,
	deletedAt: null,
	createdAt: 1_792_195_200_000,
	updatedAt: 1_792_195_200_000,
};

describe("ProductEntity", () => {
	it("carries the stored version as the concurrency token", () => {
		const entity = ProductEntity.rehydrate(PRODUCT);
		expect(entity.id).toBe(PRODUCT.id);
		expect(entity.concurrencyToken).toBe(4);
		expect(entity.toRecord()).toBe(PRODUCT);
	});

	it("treats the same id and version as equal", () => {
		const left = ProductEntity.rehydrate(PRODUCT);
		const right = ProductEntity.rehydrate({ ...PRODUCT, name: "Other name" });
		const stale = ProductEntity.rehydrate({ ...PRODUCT, version: 5 });
		expect(left.equals(right)).toBe(true);
		expect(left.equals(stale)).toBe(false);
	});
});
