import { describe, expect, it } from "vitest";

import type { ResourceIR } from "../../ir/types";
import { isTextSearchableField, resolveSearchableFieldNames, toSortableCamelNames } from "./list-query";

const sampleResourceIr: ResourceIR = {
	version: 2,
	resource: {
		name: "SampleResource",
		singular: "SampleResource",
		plural: "SampleResources",
		slug: "sample-resource",
		contractKey: "sampleResource",
		modelName: "SampleResource",
		permissionResource: "SAMPLE_RESOURCE",
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
			name: "description",
			camelName: "description",
			prismaName: "description",
			type: "text",
			required: false,
			nullable: true,
			defaultValue: undefined,
			searchable: false,
			sortable: false,
			filterable: false,
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
			navigation: undefined,
			list: {
				searchable: ["name"],
				filters: [],
				sortable: ["name", "createdAt"],
				columns: ["name"],
			},
			form: { layout: "single-column", fields: ["name"] },
		},
	},
	admin: {
		navigation: undefined,
		list: {
			searchable: ["name"],
			filters: [],
			sortable: ["name", "createdAt"],
			columns: ["name"],
		},
		form: { layout: "single-column", fields: ["name"] },
	},
	activeUi: undefined,
	events: { created: false, updated: false, deleted: false },
	audit: false,
};

describe("list-query helpers", () => {
	it("derives sortable and searchable fields from resource IR", () => {
		expect(toSortableCamelNames(sampleResourceIr)).toEqual(["name", "createdAt"]);
		expect(resolveSearchableFieldNames(sampleResourceIr)).toEqual(["name"]);
		const nameField = sampleResourceIr.fields[0];
		if (nameField === undefined) {
			throw new Error("expected sample resource to define a name field");
		}
		expect(isTextSearchableField(nameField)).toBe(true);
	});
});
