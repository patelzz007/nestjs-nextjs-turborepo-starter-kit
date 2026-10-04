import { ProductSchema, SampleCategorySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	CategoryFormSchema,
	EMPTY_CATEGORY_FORM_VALUES,
	EMPTY_PRODUCT_FORM_VALUES,
	ProductFormSchema,
	toCategoryFormValues,
	toProductFormValues,
} from "@/lib/catalog/form-values";

const CATEGORY_ID = "9b1d2e4f-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

const PRODUCT = ProductSchema.parse({
	id: "3f2a8c3e-7a53-4f5c-9d0a-0d6a6b8f2c11",
	brand: null,
	categoryId: CATEGORY_ID,
	compareAtPrice: 19.9,
	description: null,
	imageUrl: null,
	isActive: true,
	isFeatured: false,
	name: "Flat white",
	price: 12.5,
	shortDescription: null,
	sku: "FW-1",
	slug: "flat-white",
	stockQuantity: 40,
	weightGrams: null,
	version: 3,
	deletedAt: null,
	createdAt: 1_786_300_000_000,
	updatedAt: 1_786_300_000_000,
});

describe("ProductFormSchema", () => {
	it("converts the raw inputs into the create contract: numbers, blank → null/absent, trimmed text", () => {
		const parsed = ProductFormSchema.parse({
			...EMPTY_PRODUCT_FORM_VALUES,
			name: " Flat white ",
			slug: "flat-white",
			sku: "FW-1",
			categoryId: CATEGORY_ID,
			price: "12.50",
			stockQuantity: "40",
			brand: "  ",
		});

		expect(parsed).toEqual({
			name: "Flat white",
			slug: "flat-white",
			sku: "FW-1",
			categoryId: CATEGORY_ID,
			price: 12.5,
			compareAtPrice: null,
			stockQuantity: 40,
			weightGrams: null,
			brand: null,
			shortDescription: null,
			description: null,
			imageUrl: null,
			isActive: true,
			isFeatured: false,
		});
	});

	it("reports a blank or non-numeric price instead of reading it as zero", () => {
		const blank = ProductFormSchema.safeParse({ ...EMPTY_PRODUCT_FORM_VALUES, categoryId: CATEGORY_ID });
		const text = ProductFormSchema.safeParse({ ...EMPTY_PRODUCT_FORM_VALUES, categoryId: CATEGORY_ID, price: "abc" });

		expect(blank.success).toBe(false);
		expect(text.success).toBe(false);
	});

	it("defers the remaining rules to the shared contract (the category must be a UUID)", () => {
		expect(ProductFormSchema.safeParse({ ...EMPTY_PRODUCT_FORM_VALUES, price: "1", categoryId: "not-a-uuid" }).success).toBe(false);
	});

	it("round-trips a stored product through the edit form unchanged", () => {
		expect(ProductFormSchema.parse(toProductFormValues(PRODUCT))).toEqual({
			name: PRODUCT.name,
			slug: PRODUCT.slug,
			sku: PRODUCT.sku,
			categoryId: CATEGORY_ID,
			price: 12.5,
			compareAtPrice: 19.9,
			stockQuantity: 40,
			weightGrams: null,
			brand: null,
			shortDescription: null,
			description: null,
			imageUrl: null,
			isActive: true,
			isFeatured: false,
		});
	});
});

describe("CategoryFormSchema", () => {
	it("converts the raw inputs into the create contract", () => {
		expect(CategoryFormSchema.parse({ ...EMPTY_CATEGORY_FORM_VALUES, name: "Drinks", slug: "drinks", sortOrder: "2" })).toEqual({
			name: "Drinks",
			slug: "drinks",
			description: null,
			sortOrder: 2,
			isActive: true,
		});
	});

	it("leaves a blank sort order absent and rejects a fractional one", () => {
		expect(CategoryFormSchema.parse({ ...EMPTY_CATEGORY_FORM_VALUES, name: "Drinks", slug: "drinks" }).sortOrder).toBeUndefined();
		expect(CategoryFormSchema.safeParse({ ...EMPTY_CATEGORY_FORM_VALUES, name: "Drinks", slug: "drinks", sortOrder: "1.5" }).success).toBe(false);
	});

	it("pre-fills the edit form from the stored category", () => {
		const category = SampleCategorySchema.parse({
			id: CATEGORY_ID,
			description: "Hot and cold",
			isActive: false,
			name: "Drinks",
			slug: "drinks",
			sortOrder: 4,
			version: 2,
			deletedAt: null,
			createdAt: 1_786_300_000_000,
			updatedAt: 1_786_300_000_000,
		});
		expect(toCategoryFormValues(category)).toEqual({ name: "Drinks", slug: "drinks", description: "Hot and cold", sortOrder: "4", isActive: false });
	});
});
