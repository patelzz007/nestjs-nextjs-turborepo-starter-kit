import { describe, expect, it } from "vitest";

import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionSource } from "../parser/parse-resource-definition";
import { buildResourceDefinition } from "./build-definition";
import { renderResourceDefinitionSource } from "./render-definition-source";
import type { WizardResourceInput } from "./types";
import { suggestForeignKeyFieldName, toPascalCase } from "./validation";
import { buildGeneratorModulesManifest } from "../core/load-modules";
import { loadProjectConfig } from "../core/project";

const wizardInput: WizardResourceInput = {
	name: "Product",
	rls: "admin-only",
	softDelete: true,
	concurrency: false,
	idempotency: false,
	generateUi: true,
	uiModules: ["admin"],
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
		expect(definition.ui?.admin?.list?.sortable).toContain("createdAt");
		expect(definition.scope.ui).toEqual(["admin"]);
	});

	it("renders and parses a round-tripped definition", () => {
		const definition = buildResourceDefinition(wizardInput);
		const source = renderResourceDefinitionSource(definition);
		const parsed = parseResourceDefinitionSource(source, "product.resource.ts");
		const config = loadProjectConfig(process.cwd());
		const modulesManifest = buildGeneratorModulesManifest(config.rootDir);
		const ir = normalizeResourceDefinition(parsed, { modules: modulesManifest.modules });
		expect(ir.resource.slug).toBe("product");
		expect(ir.fields).toHaveLength(2);
	});

	it("normalizes resource names and foreign key suggestions", () => {
		expect(toPascalCase("sample-category")).toBe("SampleCategory");
		expect(suggestForeignKeyFieldName("SampleCategory")).toBe("categoryId");
	});
});
