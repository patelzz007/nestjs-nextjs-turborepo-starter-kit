import type { ResourceDefinition, ResourceFieldDefinition, UiModuleConfig } from "../schema/resource-definition";
import type { WizardFieldInput, WizardResourceInput } from "./types";

function buildFieldDefinition(field: WizardFieldInput): ResourceFieldDefinition {
	const definition: ResourceFieldDefinition = {
		type: field.type,
	};

	if (field.required) {
		definition.required = true;
	}
	if (field.nullable) {
		definition.nullable = true;
	}
	if (field.searchable) {
		definition.searchable = true;
	}
	if (field.sortable) {
		definition.sortable = true;
	}
	if (field.filterable) {
		definition.filterable = true;
	}
	if (field.defaultValue !== undefined) {
		definition.default = field.defaultValue;
	}
	if (field.enumValues !== undefined && field.enumValues.length > 0) {
		definition.values = [...field.enumValues];
	}
	if (field.relation !== undefined) {
		definition.relation = {
			model: field.relation.model,
			field: field.relation.field,
			cardinality: field.relation.cardinality,
		};
	}

	return definition;
}

function buildUiModuleConfig(input: WizardResourceInput, searchableFields: string[], sortableFields: string[], filterableFields: string[], columnFields: string[]): UiModuleConfig {
	return {
		navigation: {
			label: input.navigationLabel,
		},
		list: {
			searchable: searchableFields,
			sortable: sortableFields.includes("createdAt") ? sortableFields : [...sortableFields, "createdAt"],
			filters: filterableFields,
			columns: columnFields,
		},
		form: {
			layout: columnFields.length > 4 ? "two-column" : "single-column",
			fields: columnFields,
		},
	};
}

export function buildResourceDefinition(input: WizardResourceInput): ResourceDefinition {
	const fields: Record<string, ResourceFieldDefinition> = {};
	for (const field of input.fields) {
		fields[field.name] = buildFieldDefinition(field);
	}

	const searchableFields = input.fields.filter((field) => field.searchable).map((field) => field.name);
	const sortableFields = input.fields.filter((field) => field.sortable).map((field) => field.name);
	const filterableFields = input.fields.filter((field) => field.filterable).map((field) => field.name);
	const columnFields = input.fields.map((field) => field.name);

	const uiModules = input.generateUi ? input.uiModules : [];
	const ui: Record<string, UiModuleConfig> = {};
	if (input.generateUi) {
		const moduleConfig = buildUiModuleConfig(input, searchableFields, sortableFields, filterableFields, columnFields);
		for (const moduleId of uiModules) {
			ui[moduleId] = moduleConfig;
		}
	}

	const definition: ResourceDefinition = {
		version: 2,
		name: input.name,
		scope: {
			api: true,
			shared: true,
			client: true,
			ui: uiModules,
		},
		model: {
			name: input.name,
			softDelete: input.softDelete,
			concurrency: input.concurrency,
			idempotency: input.idempotency,
			rls: input.rls,
			fields,
		},
		permissions: {
			create: true,
			read: true,
			update: true,
			delete: true,
			list: true,
		},
		ui: uiModules.length > 0 ? ui : undefined,
	};

	return definition;
}
