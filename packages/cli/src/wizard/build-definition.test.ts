import { describe, expect, it } from "vitest";

import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionSource } from "../parser/parse-resource-definition";
import { buildResourceDefinition } from "./build-definition";
import { renderResourceDefinitionSource } from "./render-definition-source";
import type { WizardResourceInput } from "./types";
import { suggestForeignKeyFieldName, toPascalCase } from "./validation";

const wizardInput: WizardResourceInput = {
	name: "Product",
	rls: "admin-only",
	softDelete: true,
	concurrency: false,
	idempotency: false,
	navigationLabel: "Products",
	fields: [
		{
			name: "name",
			type: "string",
			required: true,
			nullable: false,
			searchable: true,
			sortable: true,
			filterable: false,
		},
		{
			name: "categoryId",
			type: "uuid",
			required: false,
			nullable: true,
			searchable: false,
			sortable: false,
			filterable: false,
			relation: {
				model: "SampleCategory",
				field: "categoryId",
				cardinality: "one",
			},
		},
	],
};

describe("resource wizard helpers", () => {
	it("builds a valid resource definition", () => {
		const definition = buildResourceDefinition(wizardInput);
		expect(definition.model.fields.name?.searchable).toBe(true);
		expect(definition.admin?.list?.sortable).toContain("createdAt");
	});

	it("renders and parses a round-tripped definition", () => {
		const definition = buildResourceDefinition(wizardInput);
		const source = renderResourceDefinitionSource(definition);
		const parsed = parseResourceDefinitionSource(source, "product.resource.ts");
		const ir = normalizeResourceDefinition(parsed);
		expect(ir.resource.slug).toBe("product");
		expect(ir.fields).toHaveLength(2);
	});

	it("normalizes resource names and foreign key suggestions", () => {
		expect(toPascalCase("sample-category")).toBe("SampleCategory");
		expect(suggestForeignKeyFieldName("SampleCategory")).toBe("categoryId");
	});
});
