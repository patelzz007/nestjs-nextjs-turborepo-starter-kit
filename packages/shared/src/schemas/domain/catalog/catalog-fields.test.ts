import { describe, expect, it } from "vitest";

import { CreateProductSchema } from "./product";
import { CreateSampleCategorySchema } from "./sample-category";
import { CATALOG_NAME_MAX_LENGTH, PRODUCT_SKU_MAX_LENGTH } from "./catalog-fields";

const CATEGORY_ID = "5f2d1c4b-8a7e-4b6f-9c3d-2e1f0a9b8c7d";
const VALID_PRODUCT = { categoryId: CATEGORY_ID, name: "Ceramic Mug", price: 12.5, sku: "MUG-001", slug: "ceramic-mug" };

describe("catalog field contracts", () => {
	it("trims names and rejects blank ones", () => {
		expect(CreateSampleCategorySchema.parse({ name: "  Drinkware ", slug: "drinkware" }).name).toBe("Drinkware");
		expect(CreateSampleCategorySchema.safeParse({ name: "   ", slug: "drinkware" }).success).toBe(false);
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, name: "" }).success).toBe(false);
	});

	it("bounds every text field to its column size", () => {
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, name: "x".repeat(CATALOG_NAME_MAX_LENGTH + 1) }).success).toBe(false);
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, sku: "S".repeat(PRODUCT_SKU_MAX_LENGTH + 1) }).success).toBe(false);
	});

	it("validates slug, SKU, image URL and money shapes", () => {
		expect(CreateProductSchema.safeParse(VALID_PRODUCT).success).toBe(true);
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, slug: "Ceramic Mug" }).success).toBe(false);
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, sku: "MUG 001" }).success).toBe(false);
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, imageUrl: "javascript:alert(1)" }).success).toBe(false);
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, price: -1 }).success).toBe(false);
		expect(CreateProductSchema.safeParse({ ...VALID_PRODUCT, stockQuantity: -3 }).success).toBe(false);
	});
});
