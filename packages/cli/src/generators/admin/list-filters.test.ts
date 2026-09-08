import { describe, expect, it } from "vitest";

import type { ResourceIR } from "../../ir/types";
import {
	renderListWhereFilterLines,
	renderViewDataTableFilterProps,
	renderViewFilterSchemas,
	renderViewTextFilterState,
	renderListQueryKeyBinding,
	renderZodListQueryFilterField,
	resolveTitleField,
	resolveUiSelectFilterFields,
	resolveUiTextFilterFields,
} from "./list-filters";

const productLikeIr: ResourceIR = {
	version: 2,
	resource: {
		name: "Product",
		singular: "Product",
		plural: "Products",
		slug: "product",
		contractKey: "product",
		modelName: "Product",
		permissionResource: "PRODUCT",
	},
	scope: { api: true, shared: true, client: true, ui: ["admin"] },
	fields: [
		{
			name: "name",
			camelName: "name",
			prismaName: "name",
			type: "string",
			required: true,
			nullable: false,
			defaultValue: undefined,
			searchable: true,
			sortable: true,
			filterable: false,
			min: undefined,
			max: undefined,
			enumValues: undefined,
			relation: undefined,
		},
		{
			name: "isActive",
			camelName: "isActive",
			prismaName: "isActive",
			type: "boolean",
			required: true,
			nullable: false,
			defaultValue: true,
			searchable: false,
			sortable: false,
			filterable: true,
			min: undefined,
			max: undefined,
			enumValues: undefined,
			relation: undefined,
		},
		{
			name: "brand",
			camelName: "brand",
			prismaName: "brand",
			type: "string",
			required: false,
			nullable: true,
			defaultValue: undefined,
			searchable: true,
			sortable: false,
			filterable: true,
			min: undefined,
			max: undefined,
			enumValues: undefined,
			relation: undefined,
		},
	],
	relations: [],
	workflow: undefined,
	softDelete: true,
	concurrency: false,
	idempotency: false,
	rls: "admin-only",
	cascadeSoftDeleteChildren: [],
	permissions: [],
	uiTargets: {
		admin: {
			moduleId: "admin",
			navigation: { label: "Products", icon: "Package", group: "Platform", order: 0, hiddenInProduction: false },
			list: {
				searchable: ["name"],
				filters: ["isActive", "brand"],
				sortable: ["name"],
				columns: ["name", "isActive"],
			},
			form: { layout: "single-column", fields: ["name"] },
		},
	},
	admin: {
		navigation: { label: "Products", icon: "Package", group: "Platform", order: 0, hiddenInProduction: false },
		list: {
			searchable: ["name"],
			filters: ["isActive", "brand"],
			sortable: ["name"],
			columns: ["name", "isActive"],
		},
		form: { layout: "single-column", fields: ["name"] },
	},
	activeUi: undefined,
	events: { created: false, updated: false, deleted: false },
	audit: false,
};

describe("list-filters helpers", () => {
	it("renders zod query fields for supported filter types", () => {
		const isActiveField = productLikeIr.fields[1];
		const brandField = productLikeIr.fields[2];
		if (isActiveField === undefined || brandField === undefined) {
			throw new Error("expected product-like IR fields");
		}
		expect(renderZodListQueryFilterField(isActiveField)).toContain("isActive: BooleanQueryParamSchema");
		expect(renderZodListQueryFilterField(brandField)).toContain("brand: z.string().trim().min(1).optional()");
	});

	it("generates select filters only for boolean and enum fields", () => {
		expect(resolveUiSelectFilterFields(productLikeIr).map((field) => field.camelName)).toEqual(["isActive"]);
		expect(resolveUiTextFilterFields(productLikeIr).map((field) => field.camelName)).toEqual(["brand"]);
		expect(renderViewFilterSchemas(productLikeIr)).toContain('BooleanColumnFilterSchema = z.enum(["true", "false"])');
		expect(renderViewDataTableFilterProps(productLikeIr)).toContain("filters={tableFilters}");
		expect(renderViewTextFilterState(productLikeIr)).toContain("brandFilter");
	});

	it("renders contains filters for string fields in repository where clauses", () => {
		const brandField = productLikeIr.fields[2];
		if (brandField === undefined) {
			throw new Error("expected product-like IR fields");
		}
		expect(renderListWhereFilterLines([brandField])).toContain('contains: query.brand, mode: "insensitive"');
	});

	it("prefers name and string fields for title resolution", () => {
		expect(resolveTitleField(productLikeIr)).toBe("name");
	});

	it("resolves list filters from uiTargets when admin context is unset", () => {
		const apiOnlyIr: ResourceIR = {
			...productLikeIr,
			admin: undefined,
		};
		expect(resolveUiSelectFilterFields(apiOnlyIr).map((field) => field.camelName)).toEqual(["isActive"]);
	});

	it("builds list query keys that include page and filter params", () => {
		const binding = renderListQueryKeyBinding(productLikeIr, "product");
		expect(binding.destructure).toContain("page");
		expect(binding.destructure).toContain("isActive");
		expect(binding.destructure).toContain("brand");
		expect(binding.array).toContain("isActive");
		expect(binding.array).toContain("brand");
	});
});
