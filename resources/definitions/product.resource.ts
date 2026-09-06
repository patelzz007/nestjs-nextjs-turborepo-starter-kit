import { defineResource } from "@workspace/cli";

export default defineResource({
	version: 1,
	name: "Product",
	model: {
		name: "Product",
		softDelete: true,
		concurrency: true,
		idempotency: false,
		rls: "admin-only",
		fields: {
			sku: {
				type: "string",
				required: true,
				searchable: true,
				sortable: true,
			},
			name: {
				type: "string",
				required: true,
				searchable: true,
				sortable: true,
			},
			slug: {
				type: "string",
				required: true,
				searchable: true,
				sortable: true,
			},
			shortDescription: {
				type: "string",
				nullable: true,
			},
			description: {
				type: "text",
				nullable: true,
			},
			price: {
				type: "decimal",
				required: true,
				sortable: true,
			},
			compareAtPrice: {
				type: "decimal",
				nullable: true,
				sortable: true,
			},
			stockQuantity: {
				type: "int",
				default: 0,
				sortable: true,
				filterable: true,
			},
			categoryId: {
				type: "uuid",
				required: true,
				filterable: true,
				relation: {
					model: "SampleCategory",
					field: "categoryId",
					cardinality: "one",
				},
			},
			brand: {
				type: "string",
				nullable: true,
				searchable: true,
				filterable: true,
			},
			weightGrams: {
				type: "int",
				nullable: true,
			},
			imageUrl: {
				type: "string",
				nullable: true,
			},
			isActive: {
				type: "boolean",
				default: true,
				filterable: true,
			},
			isFeatured: {
				type: "boolean",
				default: false,
				filterable: true,
			},
		},
	},
	permissions: {
		create: true,
		read: true,
		update: true,
		delete: true,
		list: true,
	},
	admin: {
		navigation: {
			label: "Products",
			group: "Platform",
			icon: "Package",
			hiddenInProduction: true,
		},
		list: {
			searchable: ["sku", "name", "slug", "brand"],
			sortable: ["sku", "name", "price", "stockQuantity", "createdAt"],
			filters: ["isActive", "isFeatured", "categoryId", "brand"],
			columns: ["sku", "name", "price", "stockQuantity", "categoryId", "isActive", "isFeatured", "createdAt"],
		},
		form: {
			layout: "two-column",
			fields: [
				"sku",
				"name",
				"slug",
				"shortDescription",
				"description",
				"price",
				"compareAtPrice",
				"stockQuantity",
				"categoryId",
				"brand",
				"weightGrams",
				"imageUrl",
				"isActive",
				"isFeatured",
			],
		},
	},
});
