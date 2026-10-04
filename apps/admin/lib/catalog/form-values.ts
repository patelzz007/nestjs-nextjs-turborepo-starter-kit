// ============================================
// lib/catalog/form-values.ts - catalog form values ⇄ shared API contracts
// ============================================
// HTML inputs hold strings; the API contracts hold numbers, nulls and
// optional fields. Each form schema below only CONVERTS the raw input (trim,
// blank → absent, text → number) and then validates the result with the
// shared create contract, which stays the single source of the validation
// rules — the browser and the API validate with the same schema.

import { CreateProductSchema, CreateSampleCategorySchema, type Product, type SampleCategory } from "@workspace/shared";
import { z } from "zod";

import {
	contractFormSchema,
	NullableNumberInputSchema,
	NullableTextInputSchema,
	OptionalNumberInputSchema,
	RequiredNumberInputSchema,
} from "@/lib/forms/contract-form-schema";

/** The product form's raw values → `CreateProductSchema` (the `POST /product` contract). */
export const ProductFormSchema = contractFormSchema(
	z.object({
		name: z.string().trim(),
		slug: z.string().trim(),
		sku: z.string().trim(),
		categoryId: z.string(),
		price: RequiredNumberInputSchema,
		compareAtPrice: NullableNumberInputSchema,
		stockQuantity: OptionalNumberInputSchema,
		weightGrams: NullableNumberInputSchema,
		brand: NullableTextInputSchema,
		shortDescription: NullableTextInputSchema,
		description: NullableTextInputSchema,
		imageUrl: NullableTextInputSchema,
		isActive: z.boolean(),
		isFeatured: z.boolean(),
	}),
	CreateProductSchema,
);

export type ProductFormValues = z.input<typeof ProductFormSchema>;

/** A new product: every text blank, active, not featured. */
export const EMPTY_PRODUCT_FORM_VALUES: ProductFormValues = {
	name: "",
	slug: "",
	sku: "",
	categoryId: "",
	price: "",
	compareAtPrice: "",
	stockQuantity: "",
	weightGrams: "",
	brand: "",
	shortDescription: "",
	description: "",
	imageUrl: "",
	isActive: true,
	isFeatured: false,
};

function numberText(value: number | null): string {
	return value === null ? "" : String(value);
}

/** The edit form's starting values: the stored product. */
export function toProductFormValues(product: Product): ProductFormValues {
	return {
		name: product.name,
		slug: product.slug,
		sku: product.sku,
		categoryId: product.categoryId,
		price: String(product.price),
		compareAtPrice: numberText(product.compareAtPrice),
		stockQuantity: String(product.stockQuantity),
		weightGrams: numberText(product.weightGrams),
		brand: product.brand ?? "",
		shortDescription: product.shortDescription ?? "",
		description: product.description ?? "",
		imageUrl: product.imageUrl ?? "",
		isActive: product.isActive,
		isFeatured: product.isFeatured,
	};
}

/** The category form's raw values → `CreateSampleCategorySchema` (the `POST /sample-category` contract). */
export const CategoryFormSchema = contractFormSchema(
	z.object({
		name: z.string().trim(),
		slug: z.string().trim(),
		description: NullableTextInputSchema,
		sortOrder: OptionalNumberInputSchema,
		isActive: z.boolean(),
	}),
	CreateSampleCategorySchema,
);

export type CategoryFormValues = z.input<typeof CategoryFormSchema>;

/** A new category: every text blank, active. */
export const EMPTY_CATEGORY_FORM_VALUES: CategoryFormValues = { name: "", slug: "", description: "", sortOrder: "", isActive: true };

/** The edit form's starting values: the stored category. */
export function toCategoryFormValues(category: SampleCategory): CategoryFormValues {
	return {
		name: category.name,
		slug: category.slug,
		description: category.description ?? "",
		sortOrder: String(category.sortOrder),
		isActive: category.isActive,
	};
}
