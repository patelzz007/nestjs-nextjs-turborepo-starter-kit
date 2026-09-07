import { describe, expect, it } from "vitest";

import { defineResource } from "../schema/resource-definition";
import { buildCascadeSoftDeleteChildren } from "./cascade-soft-delete";

const sampleCategoryDefinition = defineResource({
	version: 2,
	name: "SampleCategory",
	scope: { api: true, shared: true, client: true, ui: [] },
	model: {
		name: "SampleCategory",
		softDelete: true,
		concurrency: false,
		idempotency: false,
		rls: "admin-only",
		fields: {
			name: { type: "string", required: true },
			slug: { type: "string", required: true },
		},
	},
});

const productDefinition = defineResource({
	version: 2,
	name: "Product",
	scope: { api: true, shared: true, client: true, ui: [] },
	model: {
		name: "Product",
		softDelete: true,
		concurrency: true,
		idempotency: false,
		rls: "admin-only",
		fields: {
			name: { type: "string", required: true },
			sku: { type: "string", required: true },
			slug: { type: "string", required: true },
			price: { type: "decimal", required: true },
			categoryId: {
				type: "uuid",
				required: true,
				relation: {
					model: "SampleCategory",
					field: "categoryId",
					cascadeSoftDelete: true,
				},
			},
		},
	},
});

describe("buildCascadeSoftDeleteChildren", () => {
	it("returns child models that declare cascadeSoftDelete on a relation to the parent", () => {
		const children = buildCascadeSoftDeleteChildren("SampleCategory", [sampleCategoryDefinition, productDefinition]);
		expect(children).toEqual([
			{
				childModelName: "Product",
				childDelegate: "product",
				childSlug: "product",
				foreignKey: "categoryId",
			},
		]);
	});

	it("ignores children without cascadeSoftDelete", () => {
		const productWithoutCascade = defineResource({
			...productDefinition,
			model: {
				...productDefinition.model,
				fields: {
					...productDefinition.model.fields,
					categoryId: {
						type: "uuid",
						required: true,
						relation: {
							model: "SampleCategory",
							field: "categoryId",
						},
					},
				},
			},
		});

		expect(buildCascadeSoftDeleteChildren("SampleCategory", [productWithoutCascade])).toEqual([]);
	});
});
